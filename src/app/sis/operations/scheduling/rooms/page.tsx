"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import {
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  type Room,
  type CreateRoomPayload,
  type UpdateRoomPayload,
} from "@/lib/phase6/scheduling";
import { Toast, ToastContainer } from "@/components/ui/toast";

export default function RoomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  
  // Filters from URL
  const [filters, setFilters] = useState({
    school_id: searchParams.get("school") || "",
    status: searchParams.get("status") || "",
  });

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<Partial<CreateRoomPayload>>({
    code: "",
    name: "",
    capacity: null,
    status: "active",
  });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Fetch schools
  useEffect(() => {
    const fetchOptions = async () => {
      if (orgLoading || !organizationId) return;

      let schoolsQuery = supabase
        .from("schools")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (!isSuperAdmin) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }

      const { data: schoolsData } = await schoolsQuery;
      setSchools((schoolsData || []) as Array<{ id: string; name: string }>);
    };

    fetchOptions();
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      if (orgLoading || !organizationId) return;
      if (!filters.school_id) {
        setRooms([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await listRooms({
          school_id: filters.school_id,
          status: filters.status as any,
        });
        setRooms(data);
      } catch (error: any) {
        console.error("Error fetching rooms:", error);
        showToast(error.message || "Failed to load rooms", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [organizationId, orgLoading, filters]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.school_id) params.set("school", filters.school_id);
    if (filters.status) params.set("status", filters.status);
    router.replace(`/sis/operations/scheduling/rooms?${params.toString()}`);
  }, [filters, router]);

  const handleOpenCreate = () => {
    if (!filters.school_id) {
      showToast("You must select a school before creating rooms", "error");
      return;
    }

    setEditingRoom(null);
    setFormData({
      code: "",
      name: "",
      capacity: null,
      status: "active",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      code: room.code,
      name: room.name,
      capacity: room.capacity,
      status: room.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!organizationId || !filters.school_id) {
      return;
    }

    if (!formData.code || !formData.name) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, formData as UpdateRoomPayload);
        showToast("Room updated successfully", "success");
      } else {
        await createRoom({
          organization_id: organizationId,
          school_id: filters.school_id,
          ...formData,
        } as CreateRoomPayload);
        showToast("Room created successfully", "success");
      }
      setDialogOpen(false);
      // Refresh list
      const data = await listRooms({
        school_id: filters.school_id,
        status: filters.status as any,
      });
      setRooms(data);
    } catch (error: any) {
      console.error("Error saving room:", error);
      showToast(error.message || "Failed to save room", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (room: Room) => {
    if (!confirm(`Are you sure you want to delete room "${room.name}"?`)) {
      return;
    }

    try {
      await deleteRoom(room.id);
      showToast("Room deleted successfully", "success");
      // Refresh list
      const data = await listRooms({
        school_id: filters.school_id,
        status: filters.status as any,
      });
      setRooms(data);
    } catch (error: any) {
      console.error("Error deleting room:", error);
      showToast(error.message || "Failed to delete room", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Room
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School</Label>
              <Select
                value={filters.school_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, school_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms List */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              {filters.school_id
                ? "No rooms found. Create your first room."
                : "Please select a school to view rooms."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Rooms ({rooms.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{room.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Code: {room.code}
                      {room.capacity && <span className="ml-2">Capacity: {room.capacity}</span>}
                      <span className={`ml-2 capitalize ${room.status === "active" ? "text-green-600" : room.status === "maintenance" ? "text-yellow-600" : "text-gray-600"}`}>
                        {room.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(room)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(room)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? "Edit Room" : "Create Room"}
            </DialogTitle>
            <DialogDescription>
              Define a physical room or space for scheduling.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="e.g., R101, LAB-A"
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Room 101, Science Lab A"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={formData.capacity || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || "active"}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : editingRoom ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
