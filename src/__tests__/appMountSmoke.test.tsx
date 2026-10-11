import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import App from "../App";
import { ErrorBoundary } from "../components/ErrorBoundary";

describe("App Root Component Mount & Render", () => {
  it("renders App wrapped in ErrorBoundary without crashing", () => {
    let html = "";
    expect(() => {
      html = renderToString(
        <ErrorBoundary fallbackTitle="Error al iniciar BioAzúcar 4.0">
          <App />
        </ErrorBoundary>
      );
    }).not.toThrow();

    expect(html).toContain("BioAzúcar");
    expect(html).not.toContain("Error al iniciar BioAzúcar 4.0");
    expect(html.length).toBeGreaterThan(500);
  });
});
