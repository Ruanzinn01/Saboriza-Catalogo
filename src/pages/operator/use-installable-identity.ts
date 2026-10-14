import { useEffect } from "react";
import type { OperatorApp } from "@/lib/operator-apps";

/** Troca título, ícone e manifest enquanto o operador está no app, para a instalação ter nome e ícone próprios. */
export function useInstallableIdentity(app: Pick<OperatorApp, "name" | "manifest" | "appleIcon" | "icon">) {
  useEffect(() => {
    const previousTitle = document.title;
    const added: HTMLElement[] = [];
    const add = (tag: "link" | "meta", attrs: Record<string, string>) => {
      const element = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
      document.head.appendChild(element);
      added.push(element);
    };
    const replaced = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"], link[rel="icon"], link[rel="manifest"]'));
    replaced.forEach((link) => link.remove());

    document.title = app.name;
    add("link", { rel: "manifest", href: app.manifest });
    add("link", { rel: "apple-touch-icon", href: app.appleIcon });
    add("link", { rel: "icon", type: "image/png", href: app.icon });
    add("meta", { name: "apple-mobile-web-app-title", content: app.name });
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "mobile-web-app-capable", content: "yes" });

    return () => {
      document.title = previousTitle;
      added.forEach((element) => element.remove());
      replaced.forEach((link) => document.head.appendChild(link));
    };
  }, [app.name, app.manifest, app.appleIcon, app.icon]);
}
