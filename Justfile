set shell := ["bash", "-cu"]

default:
    @just --list

test-all:
    pnpm run test:all

test-client:
    pnpm run test:coverage:client

test-server:
    pnpm run test:server:codex

test-e2e:
    pnpm run test:e2e

coverage-client:
    pnpm run test:coverage:client

coverage-server:
    pnpm run test:coverage:server:codex
