import Editor from "@monaco-editor/react";

const LANG = { html: "html", jsx: "javascript", vue: "html", css: "css" };

export default function CodeEditor({ language = "javascript", value, onChange }) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={LANG[language] || "javascript"}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "JetBrains Mono, monospace",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
        padding: { top: 14 },
        smoothScrolling: true,
        tabSize: 2,
      }}
    />
  );
}
