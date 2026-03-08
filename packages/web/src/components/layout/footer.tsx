export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container flex h-12 items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} 큐스팅 4th</span>
        <span className="hidden sm:inline">Blog Study Dashboard</span>
      </div>
    </footer>
  );
}
