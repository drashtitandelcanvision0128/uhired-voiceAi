import { MasterShell } from "@/components/master-shell";
import { MasterBlogManager } from "@/components/master-blog-manager";

export default function MasterBlogPage() {
  return (
    <MasterShell title="Blog" subtitle="Posts on the public blog.">
      <MasterBlogManager />
    </MasterShell>
  );
}
