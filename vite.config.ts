import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages ではリポジトリ名のサブパスで配信するため、本番ビルドだけ base を変える
export default defineConfig(({ command }) => ({
	base: command === "build" ? "/postmortem-lens/" : "/",
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test-setup.ts"],
	},
}));
