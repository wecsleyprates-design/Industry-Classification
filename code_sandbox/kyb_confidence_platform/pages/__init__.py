"""Page modules, one per top-level tab.

Exposed with short stable names so `app.py` can wire them cleanly:
    from pages import executive_overview, kyb_confidence, ...
"""

from . import executive_overview  # noqa: F401
from . import kyb_confidence      # noqa: F401
from . import feature_health      # noqa: F401
from . import decision_ops        # noqa: F401
from . import entity_360          # noqa: F401
from . import inconsistency       # noqa: F401
from . import lineage_discovery   # noqa: F401
from . import data_explorer       # noqa: F401
from . import ai_copilot          # noqa: F401
