"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Edit3,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import * as XLSX from "xlsx";

import { adminFetch } from "@/services/adminApi";

const emptyWorkshop = {
  title: "",
  programArea: "",
  category: "",
  grade: "",
  description: "",
  informationUrl: "",
  registrationUrl:
    "https://saitdigitalyouth.campbrainregistration.com/",
  learningMode: "in-person",
  startDate: "",
  endDate: "",
  time: "",
  location: "",
  capacity: "",
  xpReward: 100,
  status: "active",
};

export default function AdminWorkshopsPage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [programFilter, setProgramFilter] =
    useState("all");

  const [showForm, setShowForm] =
    useState(false);

  const [editingWorkshop, setEditingWorkshop] =
    useState(null);

  const [formData, setFormData] =
    useState(emptyWorkshop);

  const [message, setMessage] = useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    loadWorkshops();
  }, []);

  async function loadWorkshops() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await adminFetch(
        "/api/admin/workshops"
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message);
      }

      setWorkshops(responseData.workshops);
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Workshops could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const programAreas = useMemo(() => {
    return [
      ...new Set(
        workshops
          .map(
            (workshop) =>
              workshop.programArea
          )
          .filter(Boolean)
      ),
    ].sort();
  }, [workshops]);

  const filteredWorkshops = useMemo(() => {
    return workshops.filter((workshop) => {
      const searchValue =
        searchText.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        workshop.title
          ?.toLowerCase()
          .includes(searchValue) ||
        workshop.programArea
          ?.toLowerCase()
          .includes(searchValue) ||
        workshop.grade
          ?.toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "all" ||
        workshop.status === statusFilter;

      const matchesProgram =
        programFilter === "all" ||
        workshop.programArea === programFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProgram
      );
    });
  }, [
    workshops,
    searchText,
    statusFilter,
    programFilter,
  ]);

  function openCreateForm() {
    setEditingWorkshop(null);
    setFormData(emptyWorkshop);
    setShowForm(true);
    setErrorMessage("");
  }

  function openEditForm(workshop) {
    setEditingWorkshop(workshop);

    setFormData({
      title: workshop.title || "",

      programArea:
        workshop.programArea || "",

      category:
        workshop.category || "",

      grade:
        workshop.grade || "",

      description:
        workshop.description || "",

      informationUrl:
        workshop.informationUrl || "",

      registrationUrl:
        workshop.registrationUrl ||
        "https://saitdigitalyouth.campbrainregistration.com/",

      learningMode:
        workshop.learningMode || "in-person",

      startDate:
        workshop.startDate || "",

      endDate:
        workshop.endDate || "",

      time:
        workshop.time || "",

      location:
        workshop.location || "",

      capacity:
        workshop.capacity ?? "",

      xpReward:
        workshop.xpReward || 100,

      status:
        workshop.status || "active",
    });

    setShowForm(true);
    setErrorMessage("");
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleSaveWorkshop(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const response = await adminFetch(
        "/api/admin/workshops",
        {
          method:
            editingWorkshop
              ? "PUT"
              : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            ...formData,
            id: editingWorkshop?.id,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message
        );
      }

      setMessage(responseData.message);
      setShowForm(false);

      await loadWorkshops();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Workshop could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorkshop(
    workshop
  ) {
    const confirmed = window.confirm(
      `Delete "${workshop.title}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      setMessage("");

      const response = await adminFetch(
        "/api/admin/workshops",
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id: workshop.id,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message
        );
      }

      setMessage(responseData.message);

      await loadWorkshops();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Workshop could not be deleted."
      );
    }
  }

  async function handleExcelImport(event) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    try {
      setImporting(true);
      setErrorMessage("");
      setMessage("");

      const fileBuffer =
        await selectedFile.arrayBuffer();

      const workbook =
        XLSX.read(fileBuffer, {
          type: "array",
        });

      const firstSheetName =
        workbook.SheetNames[0];

      const worksheet =
        workbook.Sheets[
          firstSheetName
        ];

      const excelRows =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            defval: "",
          }
        );

      const workshopsToImport =
        excelRows.map((row) => ({
          programArea:
            row["Program Area"] || "",

          title:
            row["Course Name"] || "",

          grade:
            row["Grade"] || "",

          description:
            row["Course Description"] || "",

          informationUrl:
            row["Link"] || "",
        }));

      const response = await adminFetch(
        "/api/admin/workshops/import",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            workshops:
              workshopsToImport,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message
        );
      }

      setMessage(
        responseData.message
      );

      await loadWorkshops();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Excel file could not be imported."
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  return (
    <main className="admin-workshops-page">
      <div className="admin-workshops-header">
        <div>
          <span>ADMIN DASHBOARD</span>

          <h1>Workshop Management</h1>

          <p>
            Import, create, update and manage Youth
            Initiative workshops.
          </p>
        </div>

        <div className="admin-workshop-actions">
          <label className="admin-import-button">
            {importing ? (
              <LoaderCircle
                size={19}
                className="button-spinner"
              />
            ) : (
              <Upload size={19} />
            )}

            {importing
              ? "Importing..."
              : "Import Excel"}

            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={importing}
              onChange={
                handleExcelImport
              }
            />
          </label>

          <button
            type="button"
            className="admin-create-button"
            onClick={
              openCreateForm
            }
          >
            <Plus size={19} />
            Create Workshop
          </button>
        </div>
      </div>

      {message && (
        <div className="admin-success-message">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="admin-error-message">
          {errorMessage}
        </div>
      )}

      <section className="admin-workshop-filters">
        <div className="admin-search-field">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search workshops..."
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
          />
        </div>

        <select
          value={programFilter}
          onChange={(event) =>
            setProgramFilter(
              event.target.value
            )
          }
        >
          <option value="all">
            All Program Areas
          </option>

          {programAreas.map(
            (programArea) => (
              <option
                key={programArea}
                value={programArea}
              >
                {programArea}
              </option>
            )
          )}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          <option value="all">
            All Statuses
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>
        </select>
      </section>

      <section className="admin-workshop-table-card">
        {loading ? (
          <div className="admin-workshop-loading">
            <LoaderCircle
              size={30}
              className="button-spinner"
            />

            Loading workshops...
          </div>
        ) : filteredWorkshops.length ===
          0 ? (
          <div className="admin-workshop-empty">
            <FileSpreadsheet
              size={46}
            />

            <h2>No workshops found</h2>

            <p>
              Import the client Excel file or create
              a workshop manually.
            </p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-workshop-table">
              <thead>
                <tr>
                  <th>Workshop</th>
                  <th>Program Area</th>
                  <th>Grade</th>
                  <th>Mode</th>
                  <th>XP</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredWorkshops.map(
                  (workshop) => (
                    <tr key={workshop.id}>
                      <td>
                        <strong>
                          {workshop.title}
                        </strong>

                        <span>
                          {workshop.category}
                        </span>
                      </td>

                      <td>
                        {workshop.programArea}
                      </td>

                      <td>
                        {workshop.grade}
                      </td>

                      <td>
                        {workshop.learningMode}
                      </td>

                      <td>
                        {workshop.xpReward ||
                          100}
                      </td>

                      <td>
                        <span
                          className={`admin-status-badge ${workshop.status}`}
                        >
                          {workshop.status}
                        </span>
                      </td>

                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            aria-label="Edit workshop"
                            onClick={() =>
                              openEditForm(
                                workshop
                              )
                            }
                          >
                            <Edit3
                              size={18}
                            />
                          </button>

                          <button
                            type="button"
                            className="delete"
                            aria-label="Delete workshop"
                            onClick={() =>
                              handleDeleteWorkshop(
                                workshop
                              )
                            }
                          >
                            <Trash2
                              size={18}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="admin-form-overlay">
          <section className="admin-workshop-form-card">
            <div className="admin-form-header">
              <div>
                <span>
                  {editingWorkshop
                    ? "EDIT WORKSHOP"
                    : "NEW WORKSHOP"}
                </span>

                <h2>
                  {editingWorkshop
                    ? "Update Workshop"
                    : "Create Workshop"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={23} />
              </button>
            </div>

            <form
              className="admin-workshop-form"
              onSubmit={
                handleSaveWorkshop
              }
            >
              <FormField
                label="Workshop Title"
                name="title"
                value={
                  formData.title
                }
                onChange={
                  handleInputChange
                }
                required
              />

              <div className="admin-form-two-columns">
                <FormField
                  label="Program Area"
                  name="programArea"
                  value={
                    formData.programArea
                  }
                  onChange={
                    handleInputChange
                  }
                  required
                />

                <FormField
                  label="Category"
                  name="category"
                  value={
                    formData.category
                  }
                  onChange={
                    handleInputChange
                  }
                />
              </div>

              <FormField
                label="Grade"
                name="grade"
                value={
                  formData.grade
                }
                onChange={
                  handleInputChange
                }
                required
              />

              <label className="admin-form-field">
                <span>
                  Description
                </span>

                <textarea
                  name="description"
                  rows={5}
                  value={
                    formData.description
                  }
                  onChange={
                    handleInputChange
                  }
                />
              </label>

              <div className="admin-form-two-columns">
                <label className="admin-form-field">
                  <span>
                    Learning Mode
                  </span>

                  <select
                    name="learningMode"
                    value={
                      formData.learningMode
                    }
                    onChange={
                      handleInputChange
                    }
                  >
                    <option value="in-person">
                      In Person
                    </option>

                    <option value="online">
                      Online
                    </option>

                    <option value="both">
                      Both
                    </option>
                  </select>
                </label>

                <label className="admin-form-field">
                  <span>
                    Status
                  </span>

                  <select
                    name="status"
                    value={
                      formData.status
                    }
                    onChange={
                      handleInputChange
                    }
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <div className="admin-form-two-columns">
                <FormField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={
                    formData.startDate
                  }
                  onChange={
                    handleInputChange
                  }
                />

                <FormField
                  label="End Date"
                  name="endDate"
                  type="date"
                  value={
                    formData.endDate
                  }
                  onChange={
                    handleInputChange
                  }
                />
              </div>

              <div className="admin-form-two-columns">
                <FormField
                  label="Time"
                  name="time"
                  value={
                    formData.time
                  }
                  onChange={
                    handleInputChange
                  }
                />

                <FormField
                  label="Location"
                  name="location"
                  value={
                    formData.location
                  }
                  onChange={
                    handleInputChange
                  }
                />
              </div>

              <div className="admin-form-two-columns">
                <FormField
                  label="Capacity"
                  name="capacity"
                  type="number"
                  value={
                    formData.capacity
                  }
                  onChange={
                    handleInputChange
                  }
                />

                <FormField
                  label="XP Reward"
                  name="xpReward"
                  type="number"
                  value={
                    formData.xpReward
                  }
                  onChange={
                    handleInputChange
                  }
                />
              </div>

              <FormField
                label="Information URL"
                name="informationUrl"
                type="url"
                value={
                  formData.informationUrl
                }
                onChange={
                  handleInputChange
                }
              />

              <FormField
                label="Registration URL"
                name="registrationUrl"
                type="url"
                value={
                  formData.registrationUrl
                }
                onChange={
                  handleInputChange
                }
              />

              <div className="admin-form-buttons">
                <button
                  type="button"
                  className="admin-cancel-button"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <LoaderCircle
                        size={19}
                        className="button-spinner"
                      />

                      Saving...
                    </>
                  ) : editingWorkshop ? (
                    "Update Workshop"
                  ) : (
                    "Create Workshop"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <label className="admin-form-field">
      <span>{label}</span>

      <input
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={onChange}
      />
    </label>
  );
}