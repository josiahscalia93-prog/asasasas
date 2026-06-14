import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";

const TW_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body><div id="root"></div></body>
</html>`;

export default function LivePreview({ framework, code }) {
  if (framework === "HTML/CSS") {
    return (
      <iframe
        data-testid="preview-iframe"
        title="preview"
        srcDoc={code}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full bg-white border-0"
      />
    );
  }

  if (framework === "Vue 3") {
    return (
      <SandpackProvider
        template="vue"
        theme="dark"
        files={{ "/src/App.vue": code, "/public/index.html": TW_HTML }}
      >
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton
          style={{ height: "100%" }}
        />
      </SandpackProvider>
    );
  }

  // React / Next.js
  return (
    <SandpackProvider
      template="react"
      theme="dark"
      files={{ "/App.js": code, "/public/index.html": TW_HTML }}
    >
      <SandpackPreview
        data-testid="sandpack-preview"
        showOpenInCodeSandbox={false}
        showRefreshButton
        style={{ height: "100%" }}
      />
    </SandpackProvider>
  );
}
