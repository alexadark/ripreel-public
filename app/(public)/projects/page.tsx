import Link from "next/link";
import { Plus, Film } from "lucide-react";
import { db } from "@/lib/drizzle/db";
import { projects } from "@/lib/drizzle/schema";
import { desc, ne } from "drizzle-orm";
import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/projects/empty-state";

export default async function ProjectsPage() {
  // Fetch all projects (excluding failed ones)
  const allProjects = await db
    .select()
    .from(projects)
    .where(ne(projects.status, "failed"))
    .orderBy(desc(projects.updated_at));

  return (
    <div className="min-h-screen w-full bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="border-b border-[#333] py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="font-oswald text-2xl font-bold tracking-widest hover:text-[#f5c518] transition-colors">
              ripreel<span className="text-[#f5c518]">.io</span>
            </Link>

            {/* New Project Button */}
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 bg-[#f5c518] hover:bg-white text-black font-oswald uppercase tracking-widest px-6 py-3 transition-colors"
            >
              <Plus size={20} />
              New Project
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Film className="text-[#f5c518]" size={32} />
            <h1 className="font-oswald text-4xl md:text-5xl uppercase font-bold tracking-tight text-white">
              Projects
            </h1>
          </div>
          <p className="font-courier text-[#666] text-sm">
            Manage your active productions.
          </p>
        </div>

        {/* Projects Grid or Empty State */}
        {allProjects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
