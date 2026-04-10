# %% imports
import typing as T

import numpy as np
import polars as pl
import torch
from torch.nn import Linear, Module
from torch.nn.utils.parametrize import register_parametrization

CONSTRAINT_TYPES = [
    "one",
    "inf",
    "one-inf",
    "two-inf",
]


def direct_norm(
    layer: torch.nn.Linear,
    constraint_type: str = "inf",
    always_norm: bool = False,
    max_norm: T.Optional[float] = None,
    parameter_name: str = "weight",
    vectorwise: bool = True,
) -> torch.nn.Linear:
    if constraint_type not in CONSTRAINT_TYPES:
        raise ValueError(
            f"""The constraint type {constraint_type} is not in the permitted list: \n
            {CONSTRAINT_TYPES}."""
        )

    class Normalize(torch.nn.Module):
        def forward(self, W):
            return normed_weights(W, constraint_type, always_norm, max_norm, vectorwise)

    register_parametrization(layer, parameter_name, Normalize())
    return layer


def normed_weights(
    weight: torch.Tensor,
    constraint_type: str,
    always_norm: bool,
    max_norm: T.Optional[float],
    vectorwise: bool,
) -> torch.Tensor:
    match constraint_type:
        case "one":
            norms = weight.abs().sum(axis=0)
        case "inf":
            norms = weight.abs().sum(axis=1, keepdim=True)
        case "one-inf":
            norms = weight.abs()
        case "two-inf":
            norms = torch.norm(weight, p=2, dim=1, keepdim=True)

    if not vectorwise:
        norms = norms.max()

    max_norm = max_norm or 1

    if not always_norm:
        norms = torch.max(torch.ones_like(norms), norms / max_norm)
    else:
        norms = norms / max_norm

    weight = weight / torch.max(norms, torch.ones_like(norms) * 1e-10)
    return weight


class GroupSort(Module):
    def __init__(self, num_groups: int, axis: int = -1):
        super(GroupSort, self).__init__()
        self.num_groups = num_groups
        self.axis = axis

    def forward(self, x: torch.Tensor):
        return group_sort(x, self.num_groups, self.axis)


def get_shape(x: torch.Tensor, num_groups: int, axis: int = -1) -> list:
    shape = list(x.shape)
    num_features = shape[axis]
    if num_features % num_groups:
        raise ValueError(
            f"""number of features ({num_features}) must be divisible by the number\n
              of the groups ({num_groups})."""
        )
    shape[axis] = -1
    group_size = num_features // num_groups
    if axis == -1:
        shape.append(group_size)
    else:
        shape.insert(axis + 1, group_size)
    return shape


def group_sort(x: torch.Tensor, num_groups: int, axis: int = -1) -> torch.Tensor:
    if x.shape[0] == 0:
        return x
    size = get_shape(x, num_groups, axis)
    grouped_x = x.view(*size)
    sort_dim = axis if axis == -1 else axis + 1
    sorted_grouped_x, _ = grouped_x.sort(dim=sort_dim)
    sorted_x = sorted_grouped_x.view(*x.shape)
    return sorted_x


class MonotonicWrapper(Module):
    def __init__(
        self,
        lipschitz_module: Module,
        lipschitz_constant: float = 1.0,
        monotonic_constraints: T.Optional[T.Iterable] = None,
    ):
        super().__init__()
        self.nn = lipschitz_module
        self.register_buffer(
            "lipschitz_constant",
            torch.tensor([lipschitz_constant], dtype=torch.float),
        )

        if monotonic_constraints is None:
            monotonic_constraints = [1]

        monotonic_constraints = torch.tensor(monotonic_constraints, dtype=torch.float)

        if monotonic_constraints.ndim == 1:
            monotonic_constraints = monotonic_constraints.unsqueeze(-1)
        self.register_buffer("monotonic_constraints", monotonic_constraints)

    def forward(self, x: torch.Tensor):
        mc = self.monotonic_constraints.expand(x.shape[1], -1)
        residual = self.lipschitz_constant * x @ mc
        return self.nn(x) + residual


class LipschitzLinear(Linear):
    def __init__(
        self,
        in_features: int,
        out_features: int,
        bias: bool = True,
        lipschitz_constant: float = 1.0,
        constraint_type: str = "inf",
    ):
        super().__init__(in_features, out_features, bias=bias)
        self.register_buffer(
            "lipschitz_constant",
            torch.tensor([lipschitz_constant], dtype=torch.float),
        )

        self = direct_norm(self, max_norm=lipschitz_constant, constraint_type=constraint_type)


class MonotonicClassification(torch.nn.Module):
    def __init__(self, n_inputs, width, depth, monotonics):
        super().__init__()

        def activation():
            return GroupSort(width // 2)

        layers = [
            LipschitzLinear(in_features=n_inputs, out_features=width, constraint_type="one-inf"),
            activation(),
        ]
        for _ in range(depth - 2):
            layers.append(
                LipschitzLinear(in_features=width, out_features=width, constraint_type="inf")
            )
            layers.append(activation())

        layers.append(LipschitzLinear(in_features=width, out_features=1, constraint_type="inf"))
        self.nn = MonotonicWrapper(
            lipschitz_module=torch.nn.Sequential(*layers), monotonic_constraints=monotonics
        )

    def forward(self, x):
        return self.nn(x)


class NeuralScoringLayer:
    def __init__(self, state_dict: str, device: str):
        torch.manual_seed(42)
        with torch.device(device):
            state = torch.load(state_dict, map_location=torch.device(device))
            model = MonotonicClassification(
                n_inputs=len(state["features"]),
                width=state["width"],
                depth=state["depth"],
                monotonics=state["monotonics"],
            )
            model.eval()
        self.model = model
        self.features = list(state["features"].keys())

    def predict_proba(self, X: pl.DataFrame):
        nn_preds = (
            torch.sigmoid(self.model(torch.tensor(X[self.features].to_numpy(), dtype=torch.float)))
            .squeeze()
            .tolist()
        )
        if X.height == 1:
            predictions = np.array([[1 - nn_preds, nn_preds]])
        else:
            predictions = np.array([[1 - pred, pred] for pred in nn_preds])
        return predictions
