"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortfolioPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/student/my-portfolio");
  }, [router]);

  return null;
  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMyPortfolio();
        setArtifacts(data);

        const student = await getMyStudentRow();
        if (student) {
          setCanCreate(true);
        }
      } catch (error) {
        console.error("Error fetching portfolio:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this artifact? You can't undo this action.")) {
      return;
    }

    setArchivingId(id);
    try {
      await archiveArtifact(id);
      setArtifacts(artifacts.filter(a => a.id !== id));
    } catch (error: any) {
      console.error("Error archiving artifact:", error);
      alert(error.message || "Failed to archive artifact");
    } finally {
      setArchivingId(null);
    }
  };

  const getArtifactTypeIcon = (type: string) => {
    switch (type) {
      case "link":
        return <ExternalLink className="h-4 w-4" />;
      case "text":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getVisibilityBadgeVariant = (visibility: string) => {
    switch (visibility) {
      case "shared":
        return "default";
      case "internal":
        return "secondary";
      case "private":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "submitted":
        return "default";
      case "draft":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Portfolio</h1>
          <p className="text-muted-foreground mt-2">
            View your portfolio artifacts
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/student/my-portfolio/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Artifact
          </Button>
        )}
      </div>


      {/* Portfolio Artifacts */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Artifacts ({artifacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {artifacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No portfolio artifacts found.
            </div>
          ) : (
            <div className="space-y-4">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-start justify-between border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getArtifactTypeIcon(artifact.artifact_type)}
                      <Link
                        href={`/student/my-portfolio/${artifact.id}`}
                        className="font-medium hover:underline"
                      >
                        {artifact.title}
                      </Link>
                      <Badge variant={getStatusBadgeVariant(artifact.status)}>
                        {artifact.status === "draft" ? "Draft" : "Submitted"}
                      </Badge>
                      <Badge variant={getVisibilityBadgeVariant(artifact.visibility)}>
                        {artifact.visibility}
                      </Badge>
                    </div>
                    {artifact.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{artifact.description}</p>
                    )}
                    {artifact.artifact_type === "link" && artifact.file_url && (
                      <a
                        href={artifact.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {artifact.file_url}
                      </a>
                    )}
                    {artifact.artifact_type === "text" && artifact.text_content && (
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded line-clamp-3">
                        {artifact.text_content}
                      </div>
                    )}
                    {artifact.artifact_type === "upload" && artifact.file_url && (
                      <a
                        href={artifact.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View file
                      </a>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(artifact.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link href={`/student/my-portfolio/${artifact.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {artifact.status === "draft" && (
                      <Link href={`/student/my-portfolio/${artifact.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(artifact.id)}
                      disabled={archivingId === artifact.id}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

