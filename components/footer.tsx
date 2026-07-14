export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono">s:// web url shortener</p>
        <p>
          open source on{" "}
          <a
            href="https://github.com/canary443/web-url-shortener"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline-offset-4 transition-colors hover:underline"
          >
            github
          </a>
          {" "}· grew out of a{" "}
          <a
            href="https://github.com/canary443/cli-url-shortener"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline-offset-4 transition-colors hover:underline"
          >
            cli tool
          </a>
        </p>
      </div>
    </footer>
  );
}
