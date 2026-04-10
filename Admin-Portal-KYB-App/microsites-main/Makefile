.PHONY: install-all install-case install-dashboard install-user

install-all: install-case install-dashboard install-user
	@echo "All packages installed successfully."

install-case:
	@echo "Installing in packages/case..."
	cd packages/case && npm install

install-dashboard:
	@echo "Installing in packages/dashboard..."
	cd packages/dashboard && npm install

install-user:
	@echo "Installing in packages/user..."
	cd packages/user && npm install
