"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Edit3,
  Eye,
  LoaderCircle,
  Search,
  UserRound,
  UserX,
  X,
} from "lucide-react";

import {
  adminFetch,
} from "@/services/adminApi";

export default function AdminStudentsPage() {
  const [students, setStudents] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [searchText, setSearchText] =
    useState("");

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState(null);

  const [
    editingStudent,
    setEditingStudent,
  ] = useState(null);

  const [saving, setSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await adminFetch(
          "/api/admin/students"
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Students could not be loaded."
        );
      }

      setStudents(
        data.students || []
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Students could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      if (!search) {
        return students;
      }

      return students.filter(
        (student) => {
          return [
            student.firstName,
            student.lastName,
            student.fullName,
            student.youthId,
            student.contactEmail,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(search)
            );
        }
      );
    }, [
      students,
      searchText,
    ]);

  async function saveStudent(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const response =
        await adminFetch(
          "/api/admin/students",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                editingStudent
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Student could not be updated."
        );
      }

      setMessage(
        data.message
      );

      setEditingStudent(
        null
      );

      await loadStudents();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Student could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateStudent(
    student
  ) {
    const confirmed =
      window.confirm(
        `Deactivate ${
          student.fullName ||
          student.youthId
        }?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setErrorMessage("");

      const response =
        await adminFetch(
          "/api/admin/students",
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id: student.id,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Student could not be deactivated."
        );
      }

      setMessage(
        data.message
      );

      await loadStudents();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "Student could not be deactivated."
      );
    }
  }

  return (
    <main className="admin-students-page">
      <div className="admin-page-heading">
        <div>
          <span>
            ADMIN DASHBOARD
          </span>

          <h1>
            Student Management
          </h1>

          <p>
            View and manage Youth
            Initiative student accounts.
          </p>
        </div>

        <div className="admin-student-count">
          <strong>
            {students.length}
          </strong>

          <span>
            Students
          </span>
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

      <div className="admin-student-search">
        <Search size={19} />

        <input
          type="search"
          placeholder="Search by name, Youth ID or email..."
          value={searchText}
          onChange={(event) =>
            setSearchText(
              event.target.value
            )
          }
        />
      </div>

      <section className="admin-student-table-card">
        {loading ? (
          <div className="admin-student-state">
            <LoaderCircle
              size={32}
              className="button-spinner"
            />

            Loading students...
          </div>
        ) : filteredStudents.length ===
          0 ? (
          <div className="admin-student-state">
            <UserRound
              size={43}
            />

            No students found.
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Youth ID</th>
                  <th>Learning</th>
                  <th>XP</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map(
                  (student) => (
                    <tr
                      key={
                        student.id
                      }
                    >
                      <td>
                        <strong>
                          {student.fullName ||
                            `${
                              student.firstName ||
                              ""
                            } ${
                              student.lastName ||
                              ""
                            }`}
                        </strong>

                        <span>
                          {
                            student.contactEmail
                          }
                        </span>
                      </td>

                      <td>
                        <strong className="admin-youth-id">
                          {
                            student.youthId
                          }
                        </strong>
                      </td>

                      <td>
                        {formatMode(
                          student.learningMode
                        )}
                      </td>

                      <td>
                        {student.totalXp ||
                          0}
                      </td>

                      <td>
                        {student.level ||
                          1}
                      </td>

                      <td>
                        <span
                          className={`admin-status-badge ${
                            student.accountStatus ===
                            "inactive"
                              ? "inactive"
                              : "active"
                          }`}
                        >
                          {student.accountStatus ||
                            "active"}
                        </span>
                      </td>

                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            title="View"
                            onClick={() =>
                              setSelectedStudent(
                                student
                              )
                            }
                          >
                            <Eye
                              size={17}
                            />
                          </button>

                          <button
                            type="button"
                            title="Edit"
                            onClick={() =>
                              setEditingStudent({
                                ...student,

                                interests:
                                  student.interests ||
                                  [],
                              })
                            }
                          >
                            <Edit3
                              size={17}
                            />
                          </button>

                          <button
                            type="button"
                            title="Deactivate"
                            className="delete"
                            disabled={
                              student.accountStatus ===
                              "inactive"
                            }
                            onClick={() =>
                              deactivateStudent(
                                student
                              )
                            }
                          >
                            <UserX
                              size={17}
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

      {selectedStudent && (
        <StudentViewModal
          student={
            selectedStudent
          }
          onClose={() =>
            setSelectedStudent(
              null
            )
          }
        />
      )}

      {editingStudent && (
        <StudentEditModal
          student={
            editingStudent
          }
          setStudent={
            setEditingStudent
          }
          saving={saving}
          onClose={() =>
            setEditingStudent(
              null
            )
          }
          onSubmit={
            saveStudent
          }
        />
      )}
    </main>
  );
}

function StudentViewModal({
  student,
  onClose,
}) {
  return (
    <div className="admin-student-modal-overlay">
      <section className="admin-student-modal">
        <header>
          <div>
            <span>
              STUDENT PROFILE
            </span>

            <h2>
              {student.fullName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>

        <div className="admin-student-profile-grid">
          <ProfileItem
            label="Youth ID"
            value={
              student.youthId
            }
          />

          <ProfileItem
            label="Email"
            value={
              student.contactEmail
            }
          />

          <ProfileItem
            label="Date of Birth"
            value={
              student.dateOfBirth
            }
          />

          <ProfileItem
            label="Learning Mode"
            value={formatMode(
              student.learningMode
            )}
          />

          <ProfileItem
            label="XP"
            value={
              student.totalXp ||
              0
            }
          />

          <ProfileItem
            label="Level"
            value={
              student.level ||
              1
            }
          />

          <ProfileItem
            label="Badges"
            value={
              student.badgeCount ||
              0
            }
          />

          <ProfileItem
            label="Completed Workshops"
            value={
              student.completedWorkshopCount ||
              0
            }
          />
        </div>

        <div className="admin-student-interests">
          <span>
            INTERESTS
          </span>

          <div>
            {(student.interests ||
              []).length > 0 ? (
              student.interests.map(
                (interest) => (
                  <small
                    key={
                      interest
                    }
                  >
                    {formatInterest(
                      interest
                    )}
                  </small>
                )
              )
            ) : (
              <p>
                No interests selected.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StudentEditModal({
  student,
  setStudent,
  saving,
  onClose,
  onSubmit,
}) {
  function updateField(
    name,
    value
  ) {
    setStudent(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  return (
    <div className="admin-student-modal-overlay">
      <section className="admin-student-modal">
        <header>
          <div>
            <span>
              EDIT STUDENT
            </span>

            <h2>
              Update Account
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>

        <form
          className="admin-student-edit-form"
          onSubmit={onSubmit}
        >
          <div className="admin-form-two-columns">
            <StudentField
              label="First Name"
              value={
                student.firstName ||
                ""
              }
              onChange={(value) =>
                updateField(
                  "firstName",
                  value
                )
              }
            />

            <StudentField
              label="Last Name"
              value={
                student.lastName ||
                ""
              }
              onChange={(value) =>
                updateField(
                  "lastName",
                  value
                )
              }
            />
          </div>

          <StudentField
            label="Contact Email"
            type="email"
            value={
              student.contactEmail ||
              ""
            }
            onChange={(value) =>
              updateField(
                "contactEmail",
                value
              )
            }
          />

          <label className="admin-form-field">
            <span>
              Learning Mode
            </span>

            <select
              value={
                student.learningMode ||
                ""
              }
              onChange={(event) =>
                updateField(
                  "learningMode",
                  event.target.value
                )
              }
            >
              <option value="">
                Not selected
              </option>

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
              value={
                student.accountStatus ||
                "active"
              }
              onChange={(event) =>
                updateField(
                  "accountStatus",
                  event.target.value
                )
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

          <div className="admin-student-modal-actions">
            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="button-spinner"
                  />

                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StudentField({
  label,
  value,
  onChange,
  type = "text",
}) {
  return (
    <label className="admin-form-field">
      <span>
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />
    </label>
  );
}

function ProfileItem({
  label,
  value,
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value ||
          "Not available"}
      </strong>
    </div>
  );
}

function formatMode(mode) {
  if (
    mode === "in-person"
  ) {
    return "In Person";
  }

  if (
    mode === "online"
  ) {
    return "Online";
  }

  if (
    mode === "both"
  ) {
    return "Both";
  }

  return "Not selected";
}

function formatInterest(
  interest
) {
  return interest
    .split(" ")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}