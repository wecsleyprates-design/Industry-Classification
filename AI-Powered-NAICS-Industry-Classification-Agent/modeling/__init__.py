"""
Consensus Industry Classification Modeling Package
===================================================
Trains, evaluates, and compares:
  - Production baseline  : customer_table.sql winner-takes-all rule
  - Consensus XGBoost    : 45-feature multi:softprob classifier

Run the full experiment:
    python modeling/experiment.py --mode full

Or import individual modules:
    from modeling.data_loader import DataLoader
    from modeling.level2_trainer import Level2Trainer
"""
