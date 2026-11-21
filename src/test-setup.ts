import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// globals を使わない設定では Testing Library の自動の片付けが働かないため、ここで行う
afterEach(() => {
	cleanup();
});
