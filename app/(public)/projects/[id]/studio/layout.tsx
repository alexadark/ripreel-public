import { ReactNode } from "react";
import { db } from "@/lib/drizzle/db";
import { projects } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Home, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface StudioLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function StudioLayout({ children, params }: StudioLayoutProps) {
  const { id } = await params;

  // Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="border-b border-[#333] py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Left side - Navigation and Logo */}
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#888] hover:text-[#f5c518] hover:bg-[#1c1c1f]"
                  >
                    <ArrowLeft size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="bg-[#1c1c1f] border-[#333] text-white"
                >
                  <DropdownMenuItem asChild>
                    <Link
                      href="/"
                      className="flex items-center gap-2 cursor-pointer hover:bg-[#333] focus:bg-[#333]"
                    >
                      <Home size={16} />
                      <span className="font-courier">Home</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/projects"
                      className="flex items-center gap-2 cursor-pointer hover:bg-[#333] focus:bg-[#333]"
                    >
                      <FolderOpen size={16} />
                      <span className="font-courier">All Projects</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link href="/" className="font-oswald text-xl font-bold tracking-widest">
                ripreel<span className="text-[#f5c518]">.io</span>
              </Link>
            </div>

            {/* Center - Project Info */}
            <div className="flex items-center gap-3">
              <h1 className="font-oswald text-lg uppercase text-white">{project.title}</h1>
              <Badge className="bg-[#f5c518] text-black font-oswald uppercase text-xs">
                {project.visual_style}
              </Badge>
              <Badge className="bg-[#1c1c1f] text-[#888] border border-[#333] font-courier text-xs">
                {project.status.replace("_", " ")}
              </Badge>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
              <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex">
        <StudioSidebar projectId={id} />
        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-73px)]">
          {children}
        </main>
      </div>
    </div>
  );
}







