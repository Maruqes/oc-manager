import type { ReactNode } from "react";

type MainLayoutProps = {
  sidebar: ReactNode;
  main: ReactNode;
  aside: ReactNode;
};

export function MainLayout({ sidebar, main, aside }: MainLayoutProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">{sidebar}</aside>
      <main className="app-main">{main}</main>
      <aside className="app-aside">{aside}</aside>
    </div>
  );
}
