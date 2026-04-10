.PHONY: help install dev build start test lint clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	npm install

dev: ## Start development server
	npm run dev

build: ## Build the application
	npm run build

start: ## Start production server
	npm start

test: ## Run tests
	npm test

lint: ## Run linter
	npm run lint

lint:fix ## Fix linting issues
	npm run lint:fix

clean: ## Clean build artifacts
	rm -rf dist
	rm -rf node_modules
	rm -rf coverage

docker:build: ## Build Docker image
	docker build -t workflow-service .

docker:run: ## Run Docker container
	docker run -p 3007:3007 workflow-service

docker:compose:up: ## Start services with docker-compose
	docker-compose up -d

docker:compose:down: ## Stop services with docker-compose
	docker-compose down

docker:compose:logs: ## View docker-compose logs
	docker-compose logs -f
