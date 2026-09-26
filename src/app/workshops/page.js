"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  BookOpen,
  ChevronDown,
  Filter,
  Home,
  LoaderCircle,
  Map,
  Search,
  Trophy,
  UserRound,
  X,
} from "lucide-react";

import WorkshopCard from "@/components/workshops/WorkshopCard";

import {
  studentFetch,
} from "@/services/studentApi";

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [programFilter, setProgramFilter] =
    useState("all");
  const [modeFilter, setModeFilter] =
    useState("all");
  const [gradeFilter, setGradeFilter] =
    useState("all");

  const [showMobileFilters, setShowMobileFilters] =
    useState(false);

  useEffect(() => {
    async function loadWorkshops() {
      try {
        setLoading(true);

        const response = await studentFetch("/api/workshops");
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message);
        }

        setWorkshops(responseData.workshops);
      } catch (error) {
        setErrorMessage(
          error.message || "Workshops could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    loadWorkshops();
  }, []);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          workshops
            .map((workshop) => workshop.category)
            .filter(Boolean)
        ),
      ].sort(),
    [workshops]
  );

  const programAreas = useMemo(
    () =>
      [
        ...new Set(
          workshops
            .map((workshop) => workshop.programArea)
            .filter(Boolean)
        ),
      ].sort(),
    [workshops]
  );

  const grades = useMemo(
    () =>
      [
        ...new Set(
          workshops
            .map((workshop) => workshop.grade)
            .filter(Boolean)
        ),
      ].sort(),
    [workshops]
  );

  const filteredWorkshops = useMemo(() => {
    const normalizedSearch =
      searchText.trim().toLowerCase();

    return workshops.filter((workshop) => {
      const matchesSearch =
        !normalizedSearch ||
        workshop.title
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        workshop.description
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        workshop.category
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "all" ||
        workshop.category === categoryFilter;

      const matchesProgram =
        programFilter === "all" ||
        workshop.programArea === programFilter;

      const matchesMode =
        modeFilter === "all" ||
        workshop.learningMode === modeFilter ||
        workshop.learningMode === "both";

      const matchesGrade =
        gradeFilter === "all" ||
        workshop.grade === gradeFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesProgram &&
        matchesMode &&
        matchesGrade
      );
    });
  }, [
    workshops,
    searchText,
    categoryFilter,
    programFilter,
    modeFilter,
    gradeFilter,
  ]);

  const activeFilterCount = [
    categoryFilter,
    programFilter,
    modeFilter,
    gradeFilter,
  ].filter((filterValue) => filterValue !== "all").length;

  function clearFilters() {
    setSearchText("");
    setCategoryFilter("all");
    setProgramFilter("all");
    setModeFilter("all");
    setGradeFilter("all");
  }

  return (
    <main className="student-workshops-page">
      <header className="student-app-header">
        <div className="student-app-header-content">
          <Link href="/dashboard">
            <Image
              src="/images/landing/sait-logo.jpg"
              alt="SAIT"
              width={170}
              height={60}
              className="student-header-logo"
            />
          </Link>

          <nav className="student-desktop-navigation">
            <Link href="/dashboard">Home</Link>
            <Link
              href="/workshops"
              className="active"
            >
              Workshops
            </Link>
            <Link href="/journey">Journey</Link>
            <Link href="/badges">Badges</Link>
            <Link href="/profile">Profile</Link>
          </nav>
        </div>
      </header>

      <section className="workshops-hero-section">
        <div className="student-content-container workshops-hero-content">
          <div>
            <span className="workshops-small-label">
              Explore opportunities
            </span>

            <h1>Find Your Next Workshop</h1>

            <p>
              Discover workshops based on your interests,
              preferred learning mode and future goals.
            </p>
          </div>

          <div className="workshop-hero-stat">
            <strong>{filteredWorkshops.length}</strong>
            <span>Workshops Available</span>
          </div>
        </div>
      </section>

      <section className="student-content-container workshops-main-content">
        <div className="workshop-search-row">
          <div className="student-workshop-search">
            <Search size={20} />

            <input
              type="search"
              placeholder="Search workshops..."
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
            />

            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
              >
                <X size={18} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="mobile-filter-button"
            onClick={() =>
              setShowMobileFilters(
                (currentValue) => !currentValue
              )
            }
          >
            <Filter size={19} />
            Filters

            {activeFilterCount > 0 && (
              <span>{activeFilterCount}</span>
            )}
          </button>
        </div>

        <div
          className={`workshop-filter-panel ${
            showMobileFilters ? "show" : ""
          }`}
        >
          <FilterSelect
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories}
          />

          <FilterSelect
            label="Program Area"
            value={programFilter}
            onChange={setProgramFilter}
            options={programAreas}
          />

          <FilterSelect
            label="Learning Mode"
            value={modeFilter}
            onChange={setModeFilter}
            options={[
              {
                value: "in-person",
                label: "In Person",
              },
              {
                value: "online",
                label: "Online",
              },
              {
                value: "both",
                label: "Both",
              },
            ]}
            useObjects
          />

          <FilterSelect
            label="Grade"
            value={gradeFilter}
            onChange={setGradeFilter}
            options={grades}
          />

          {activeFilterCount > 0 && (
            <button
              type="button"
              className="clear-workshop-filters"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="workshop-results-heading">
          <div>
            <h2>
              {activeFilterCount > 0 || searchText
                ? "Matching Workshops"
                : "All Workshops"}
            </h2>

            <p>
              Showing {filteredWorkshops.length} of{" "}
              {workshops.length} workshops
            </p>
          </div>
        </div>

        {loading ? (
          <div className="student-workshop-status">
            <LoaderCircle
              size={35}
              className="button-spinner"
            />
            <p>Loading workshops...</p>
          </div>
        ) : errorMessage ? (
          <div className="student-workshop-error">
            {errorMessage}
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <div className="student-workshop-empty">
            <BookOpen size={48} />

            <h2>No workshops found</h2>

            <p>
              Try changing or clearing your filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
            >
              View All Workshops
            </button>
          </div>
        ) : (
          <div className="student-workshop-grid">
            {filteredWorkshops.map((workshop) => (
              <WorkshopCard
                key={workshop.id}
                workshop={workshop}
              />
            ))}
          </div>
        )}
      </section>

      <nav className="student-bottom-navigation">
        <Link href="/dashboard">
          <Home size={20} />
          <span>Home</span>
        </Link>

        <Link
          href="/workshops"
          className="active"
        >
          <BookOpen size={20} />
          <span>Workshops</span>
        </Link>

        <Link href="/journey">
          <Map size={20} />
          <span>Journey</span>
        </Link>

        <Link href="/badges">
          <Trophy size={20} />
          <span>Badges</span>
        </Link>

        <Link href="/profile">
          <UserRound size={20} />
          <span>Profile</span>
        </Link>
      </nav>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  useObjects = false,
}) {
  return (
    <label className="workshop-filter-field">
      <span>{label}</span>

      <div>
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
        >
          <option value="all">All</option>

          {options.map((option) => {
            const optionValue = useObjects
              ? option.value
              : option;

            const optionLabel = useObjects
              ? option.label
              : option;

            return (
              <option
                key={optionValue}
                value={optionValue}
              >
                {optionLabel}
              </option>
            );
          })}
        </select>

        <ChevronDown size={16} />
      </div>
    </label>
  );
}