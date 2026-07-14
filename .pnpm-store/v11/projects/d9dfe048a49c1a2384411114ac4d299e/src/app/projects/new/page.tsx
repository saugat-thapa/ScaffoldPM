"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CalendarIcon,
  UploadCloud,
  Plus,
  Undo2,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarRange } from "@/components/RangeCalendar";
import { type DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getMembers, generateWBS, type TeamMember } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Team members states
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [errorMembers, setErrorMembers] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  // Dialog and Search states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch team members from backend
  useEffect(() => {
    async function fetchMembers() {
      setLoadingMembers(true);
      setErrorMembers(null);
      try {
        const data = await getMembers();
        setMembers(data);
      } catch (err) {
        console.error(err);
        setErrorMembers("Failed to load organization employees.");
      } finally {
        setLoadingMembers(false);
      }
    }
    fetchMembers();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-red-50 text-red-600 border-red-200",
      "bg-orange-50 text-orange-600 border-orange-200",
      "bg-amber-50 text-amber-600 border-amber-200",
      "bg-emerald-50 text-emerald-600 border-emerald-200",
      "bg-blue-50 text-blue-600 border-blue-200",
      "bg-indigo-50 text-indigo-600 border-indigo-200",
      "bg-purple-50 text-purple-600 border-purple-200",
      "bg-pink-50 text-pink-600 border-pink-200",
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const nextStep = async () => {
    if (step < 3) {
      if (step === 1) {
        if (!formData.name.trim()) {
          alert("Please enter a project name.");
          return;
        }
        if (!dateRange?.from || !dateRange?.to) {
          alert("Please select the project start and end dates.");
          return;
        }
      }
      if (step === 2 && !selectedFile) {
        alert("Please upload a project document to proceed.");
        return;
      }
      setStep(step + 1);
    } else {
      if (selectedMemberIds.length === 0) {
        alert("Please assign at least one team member to the project.");
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      try {
        const payload = {
          project_name: formData.name,
          start_date: format(dateRange!.from!, "yyyy-MM-dd"),
          end_date: format(dateRange!.to!, "yyyy-MM-dd"),
          team_members: members.filter((m) => selectedMemberIds.includes(m.id)),
        };

        const response = await generateWBS(selectedFile!, payload);
        router.push(`/projects/${response.project.id}`);
      } catch (err: any) {
        console.error(err);
        setSubmitError(
          err.message || "Failed to generate project plan. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else router.push("/projects");
  };

  const toggleTempMember = (id: string) => {
    if (tempSelectedIds.includes(id)) {
      setTempSelectedIds(tempSelectedIds.filter((mId) => mId !== id));
    } else {
      setTempSelectedIds([...tempSelectedIds, id]);
    }
  };

  const removeSelectedMember = (id: string) => {
    setSelectedMemberIds(selectedMemberIds.filter((mId) => mId !== id));
  };

  const handleOpenDialog = () => {
    setTempSelectedIds([...selectedMemberIds]);
    setSearchQuery("");
    setIsDialogOpen(true);
  };

  const handleApplySelection = () => {
    setSelectedMemberIds([...tempSelectedIds]);
    setIsDialogOpen(false);
  };

  // Filter members based on search query
  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query) ||
      member.skills.some((skill) => skill.toLowerCase().includes(query))
    );
  });

  const selectedMembersList = members.filter((m) =>
    selectedMemberIds.includes(m.id),
  );

  if (submitting) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
          <h2 className="text-2xl font-semibold text-slate-800">
            Creating Project Plan
          </h2>
          <p className="text-slate-500 text-md">
            Analyzing document structure, generating WBS milestones, assigning
            tasks, and optimizing schedule. This may take up to a minute...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pt-36 pb-16">
      <div className="flex items-center justify-center gap-20">
        <main className="w-full max-w-2xl px-6">
          {/* Header */}
          <div className="flex items-center mb-12">
            <button
              onClick={() => router.push("/projects")}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors mr-4"
            >
              <X className="w-6 h-6 text-slate-700" />
            </button>
            <h1 className="text-2xl font-medium text-slate-700">
              Add a project
            </h1>
          </div>

          {/* Content */}
          <div className="pl-12">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-[32px] font-semibold text-slate-900 leading-tight mb-8">
                  Let&apos;s start with a name for
                  <br />
                  your project
                </h2>

                <div className="space-y-6 max-w-md">
                  <input
                    type="text"
                    placeholder="Enter your project name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full text-xl bg-transparent border-b-2 border-slate-200 pb-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-400 transition-colors"
                  />

                  <input
                    type="text"
                    placeholder="Enter Project Description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full text-lg bg-transparent border-b-2 border-slate-200 pb-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-400 transition-colors"
                  />

                  <div className="relative">
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button
                            className={`w-full flex items-center text-lg bg-transparent border-b-2 border-slate-200 pb-2 focus:outline-none focus:border-blue-500 transition-colors ${
                              !dateRange ? "text-slate-400" : "text-slate-900"
                            }`}
                          >
                            <CalendarIcon className="w-5 h-5 mr-3 text-slate-400" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "LLL dd, y")} -{" "}
                                  {format(dateRange.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(dateRange.from, "LLL dd, y")
                              )
                            ) : (
                              <span>Select Project Duration</span>
                            )}
                          </button>
                        }
                      />

                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarRange
                          dateRange={dateRange}
                          setDateRange={setDateRange}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-[32px] font-semibold text-slate-900 leading-tight">
                  Add a document
                </h2>
                <p className="text-lg text-slate-500 max-w-lg mb-8">
                  Upload a project brief, proposal, or any document to
                  automatically generate structured tasks and kickstart your
                  workflow.
                </p>

                {selectedFile ? (
                  <div className="max-w-xl border border-slate-200 bg-white rounded-xl p-6 flex items-center justify-between shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-50 rounded-xl text-blue-500">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm max-w-[280px] truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="files"
                    className="max-w-xl border-2 border-dashed border-blue-300 bg-blue-50/30 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/50 transition-colors gap-3"
                  >
                    <UploadCloud className="w-10 h-10 text-blue-500" />
                    <span className="text-slate-600 text-md font-medium">
                      Upload your document
                    </span>
                    <span className="text-xs text-slate-400 text-center max-w-xs">
                      PDF, DOCX, TXT or similar formats supported
                    </span>
                    <input
                      id="files"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-[32px] font-semibold text-slate-900 leading-tight">
                  Assign Team Members
                </h2>
                <p className="text-lg text-slate-500 max-w-lg mb-8">
                  Assign team members from your organization. The system will
                  intelligently match them to generated tasks based on their
                  roles and skills.
                </p>

                {selectedMembersList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mb-4">
                    {selectedMembersList.map((member) => (
                      <div
                        key={member.id}
                        className="relative border border-slate-200 rounded-xl p-4 flex items-center bg-white shadow-sm hover:border-slate-300 transition-all group"
                      >
                        <div
                          className={`w-10 h-10 rounded-full border flex items-center justify-center font-semibold text-sm mr-3 shrink-0 ${getAvatarColor(
                            member.name,
                          )}`}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm truncate">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {member.role}
                          </p>
                        </div>
                        <button
                          onClick={() => removeSelectedMember(member.id)}
                          className="absolute top-2 right-2 p-1 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  onClick={handleOpenDialog}
                  className="max-w-xl border border-slate-200 border-dashed rounded-xl p-6 flex items-center justify-center bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all text-slate-600"
                >
                  <Plus className="w-6 h-6 text-slate-500 mr-2" />
                  <span className="text-slate-600 font-semibold">
                    {selectedMemberIds.length > 0
                      ? "Manage team members"
                      : "Add team members"}
                  </span>
                </div>

                {submitError && (
                  <p className="text-red-500 text-sm font-medium mt-4">
                    {submitError}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-16 flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={prevStep}
                className="px-4 py-3 w-[120px] rounded-xl"
              >
                <Undo2 className="w-5 h-5 mr-2" />
                Go Back
              </Button>
              <Button
                onClick={nextStep}
                className="px-5 py-3 w-[120px] rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm transition-colors duration-300 ease-in-out"
              >
                {step === 3 ? "Submit" : "Continue"}
              </Button>
            </div>
          </div>
        </main>
        <img src="/img.svg" alt="image" className="w-[300px] h-[300px]" />
      </div>

      {/* dialog list component */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl w-[90vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Select Team Members
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Search and select employees to add to this project.
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative mt-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, role, or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Members List Container */}
          <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2 max-h-[40vh]">
            {loadingMembers ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span>Loading team members...</span>
              </div>
            ) : errorMembers ? (
              <div className="py-8 text-center text-red-500">
                {errorMembers}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No matching team members found.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isChecked = tempSelectedIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleTempMember(member.id)}
                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                      isChecked
                        ? "border-blue-500 bg-blue-50/20"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full border flex items-center justify-center font-semibold text-xs mr-3 shrink-0 ${getAvatarColor(
                        member.name,
                      )}`}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-baseline justify-between">
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="text-[12px] uppercase font-bold text-slate-400 tracking-wider">
                            {member.experience} -
                          </span>
                          <p className="text-xs text-slate-500 truncate ">
                            {member.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {member.skills.slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className="inline-block px-1.5 py-0.5 bg-slate-100 text-[10px] text-slate-600 rounded font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {member.skills.length > 3 && (
                          <span className="inline-block px-1 py-0.5 bg-slate-100 text-[9px] text-slate-500 rounded font-medium">
                            +{member.skills.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center justify-center">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          isChecked
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isChecked && (
                          <svg
                            className="w-3.5 h-3.5 stroke-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between border-t border-slate-100 mt-6 pt-4 shrink-0">
            <span className="text-xs text-slate-500">
              {tempSelectedIds.length} employee(s) selected
            </span>
            <div className="flex space-x-3">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySelection}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                Apply Selection
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
