import { renderSimpleMarkdown } from "@/lib/simple-markdown";

type MarkdownContentProps = {
  source: string;
  className?: string;
};

export function MarkdownContent({ source, className = "" }: MarkdownContentProps) {
  const html = renderSimpleMarkdown(source);
  return (
    <div
      className={`markdown-content space-y-3 text-foreground leading-relaxed [&_a]:text-primary [&_a]:underline [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
