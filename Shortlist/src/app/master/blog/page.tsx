import { MasterShell } from "@/components/master-shell";
import { MasterBlogManager } from "@/components/master-blog-manager";

export default function MasterBlogPage() {
  return (
    <MasterShell
      title="Blog"
      subtitle="Create, edit, and publish posts for the public /blog page. Only published posts are visible to visitors."
    >
      <MasterBlogManager />
    </MasterShell>
  );
}
