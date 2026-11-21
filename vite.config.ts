import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * 万一の XSS に備え、読み込めるスクリプトを自分のものだけにし、外への通信を許さない。
 * 開発サーバーはインラインのスクリプトを使うため、本番ビルドにだけ入れる。
 */
export const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self'",
	"img-src 'self' data:",
	"connect-src 'none'",
	"base-uri 'none'",
	"form-action 'none'",
	"object-src 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
	return {
		name: "content-security-policy",
		apply: "build",
		transformIndexHtml() {
			return [
				{
					tag: "meta",
					attrs: {
						"http-equiv": "Content-Security-Policy",
						content: CONTENT_SECURITY_POLICY,
					},
					injectTo: "head-prepend",
				},
			];
		},
	};
}

// GitHub Pages ではリポジトリ名のサブパスで配信するため、本番ビルドだけ base を変える
export default defineConfig(({ command }) => ({
	base: command === "build" ? "/postmortem-lens/" : "/",
	plugins: [react(), contentSecurityPolicy()],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test-setup.ts"],
	},
}));
