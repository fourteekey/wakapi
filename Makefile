# Local dev helpers for running Wakapi against the existing SQLite database
# (wakapi.db in the project root).
#
# That DB came from production, which ran with an EMPTY password salt, so none of
# the run targets set WAKAPI_PASSWORD_SALT — otherwise existing logins / API keys
# would stop validating.

IMAGE            ?= wakapi:dev
PROD_IMAGE       ?= ghcr.io/muety/wakapi:latest
CONTAINER        ?= wakapi
PORT             ?= 3000
DB               ?= $(CURDIR)/wakapi.db
PUBLIC_URL       ?= https://waka.iordanov.pro
INSECURE_COOKIES ?= false

# Remote deploy (run on the server): build straight from a GitHub branch and
# recreate the prod container against the named data volume.
REPO             ?= https://github.com/fourteekey/wakapi.git
BRANCH           ?= feat/search-by-branch
DEPLOY_IMAGE     ?= my-wakapi:latest
VOLUME           ?= wakapi-data

.PHONY: help docker-build docker-run docker-prod docker-logs docker-stop run deploy

help:
	@echo "Targets:"
	@echo "  make docker-run   Build LOCAL image (your code changes) + run against ./wakapi.db on http://localhost:$(PORT)"
	@echo "  make docker-prod  Run official ghcr.io image against ./wakapi.db (mirrors prod command)"
	@echo "  make docker-logs  Follow container logs"
	@echo "  make docker-stop  Stop & remove the container"
	@echo "  make run          Run natively with 'go run .' (fastest loop, env=dev template hot-reload)"
	@echo "  make deploy       (on server) Build image from BRANCH on GitHub + recreate prod container"
	@echo "                    override branch: make deploy BRANCH=master"

docker-build:
	docker build -t $(IMAGE) .

# YOUR code, YOUR data. Local http access -> insecure cookies on so you can log in.
# No password salt, to match the production database.
docker-run: docker-build docker-stop
	chmod 666 "$(DB)"
	docker run -d --name $(CONTAINER) \
		-p 127.0.0.1:$(PORT):3000 \
		-v "$(DB):/data/wakapi.db" \
		-e WAKAPI_DB_TYPE=sqlite3 \
		-e WAKAPI_DB_NAME=/data/wakapi.db \
		-e WAKAPI_ALLOW_SIGNUP=false \
		-e WAKAPI_PUBLIC_URL=http://localhost:$(PORT) \
		-e WAKAPI_INSECURE_COOKIES=true \
		--restart unless-stopped \
		$(IMAGE)
	@echo "Wakapi (local build) running at http://localhost:$(PORT)"

# Mirrors the production docker run command, but mounts ./wakapi.db instead of the
# wakapi-data named volume. Official image -> none of your local code changes.
# For login over plain http: make docker-prod INSECURE_COOKIES=true
docker-prod: docker-stop
	chmod 666 "$(DB)"
	docker run -d --name $(CONTAINER) \
		-p 127.0.0.1:$(PORT):3000 \
		-v "$(DB):/data/wakapi.db" \
		-e WAKAPI_DB_TYPE=sqlite3 \
		-e WAKAPI_DB_NAME=/data/wakapi.db \
		-e WAKAPI_ALLOW_SIGNUP=false \
		-e WAKAPI_PUBLIC_URL=$(PUBLIC_URL) \
		-e WAKAPI_INSECURE_COOKIES=$(INSECURE_COOKIES) \
		--restart unless-stopped \
		$(PROD_IMAGE)
	@echo "Wakapi (official image) running at http://127.0.0.1:$(PORT)"

docker-logs:
	docker logs -f $(CONTAINER)

docker-stop:
	-docker rm -f $(CONTAINER) 2>/dev/null || true

# Native run — fastest loop for template/handler changes. Templates hot-reload with env=dev.
run:
	ENVIRONMENT=dev \
	WAKAPI_DB_TYPE=sqlite3 \
	WAKAPI_DB_NAME=$(DB) \
	go run .

# Run this ON THE SERVER. Builds the image directly from BRANCH on GitHub (no clone
# needed) and recreates the prod container. Data lives in the $(VOLUME) named volume,
# so stopping/removing the container does NOT touch the database.
# Deploy another branch: make deploy BRANCH=master
deploy:
	docker build -t $(DEPLOY_IMAGE) "$(REPO)#$(BRANCH)"
	-docker rm -f $(CONTAINER) 2>/dev/null || true
	docker run -d --name $(CONTAINER) \
		-p 127.0.0.1:$(PORT):3000 \
		-v $(VOLUME):/data \
		-e WAKAPI_PUBLIC_URL=$(PUBLIC_URL) \
		-e WAKAPI_INSECURE_COOKIES=$(INSECURE_COOKIES) \
		--restart unless-stopped \
		$(DEPLOY_IMAGE)
	@echo "Wakapi ($(BRANCH)) deployed as $(CONTAINER) -> $(PUBLIC_URL)"
