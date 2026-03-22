import React, { useState, useEffect, useRef } from "react";
import {
  PlaySquare,
  Plus,
  Save,
  Trash2,
  Edit2,
  Search,
  Activity,
  Trophy,
  X,
  FileSpreadsheet,
  Users,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
} from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const LEVELS = ["0.5", "1", "2", "3", "4", "5", "6", "7", "8"];

const CATEGORIES = {
  "Rope Manipulation": [
    "Basic/Wrap",
    "Crosses",
    "Footwork",
    "Release",
    "Rotation",
  ],
  Multiples: [],
  "Power/Gymnastics": ["Power", "Gymnastics"],
};

const DEFAULT_SKILLS = [
  {
    id: "sample-1",
    name: "Toad (TJ)",
    level: "1",
    category: "Rope Manipulation",
    subcategory: "Crosses",
    description:
      "A cross under one leg where the opposite arm goes under the leg and jumps the rope.",
    socialLink: "https://youtube.com",
  },
];

const DEFAULT_ROUTINES = [];

function useCloudSyncState(docName, localKey, defaultVal) {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(localKey);
    return saved ? JSON.parse(saved) : defaultVal;
  });
  const [isLoaded, setIsLoaded] = useState(!!localStorage.getItem(localKey));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "app_data", docName), (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data().items || defaultVal;
        setState((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(remoteData)) {
            localStorage.setItem(localKey, JSON.stringify(remoteData));
            return remoteData;
          }
          return prev;
        });
        setIsLoaded(true);
      } else {
        // If the document doesn't exist in the cloud at all, seed it with our local data
        const saved = localStorage.getItem(localKey);
        const seedData = saved ? JSON.parse(saved) : defaultVal;
        setDoc(doc(db, "app_data", docName), { items: seedData }).catch(e => console.warn("Seed error:", e));
        setIsLoaded(true);
      }
    });
    return unsub;
  }, [docName, localKey]);

  const updateState = React.useCallback((newValOrUpdater) => {
    setState((prev) => {
      const newVal = typeof newValOrUpdater === "function" ? newValOrUpdater(prev) : newValOrUpdater;
      localStorage.setItem(localKey, JSON.stringify(newVal));
      setDoc(doc(db, "app_data", docName), { items: newVal }).catch(e => console.warn("Firestore error (enable database in console):", e));
      return newVal;
    });
  }, [docName, localKey]);

  return [state, updateState, isLoaded];
}

// Component purely for the inline typing experience
const SkillRowInput = ({ rowId, rawSkills = [], onChange, library }) => {
  const [inputValue, setInputValue] = useState("");

  const searchStr = inputValue.toLowerCase().trim();
  const prediction =
    searchStr.length > 0
      ? library.find(
          (s) =>
            s.name.toLowerCase().startsWith(searchStr) &&
            s.name.toLowerCase() !== searchStr,
        )
      : null;

  const predictionRemainder = prediction
    ? prediction.name.substring(inputValue.length)
    : "";

  const parseTokens = (str) => {
    const result = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "(") depth++;
      else if (str[i] === ")") depth--;

      if (str[i] === "," && depth === 0) {
        if (current.trim()) result.push(current.trim());
        current = "";
      } else {
        current += str[i];
      }
    }
    if (current.trim()) result.push(current.trim());
    return result;
  };

  const addToken = (val) => {
    const parts = parseTokens(val);
    if (parts.length > 0) {
      onChange(rowId, [...rawSkills, ...parts]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab" || e.key === "ArrowRight") {
      if (prediction) {
        e.preventDefault();
        setInputValue(prediction.name);
        return;
      }
    }
    if (e.key === "," || e.key === "Enter") {
      // Bracket-aware comma check: only tokenize if all brackets are closed
      if (e.key === ",") {
        const openCount = (inputValue.match(/\(/g) || []).length;
        const closedCount = (inputValue.match(/\)/g) || []).length;
        if (openCount > closedCount) return;
      }

      e.preventDefault();
      if (inputValue.trim()) {
        if (prediction && e.key === "Enter") {
          addToken(prediction.name);
        } else {
          addToken(inputValue);
        }
      }
    } else if (e.key === "Backspace" && inputValue === "") {
      e.preventDefault();
      if (rawSkills.length > 0) {
        const newArr = [...rawSkills];
        newArr.pop();
        onChange(rowId, newArr);
      }
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addToken(inputValue);
    }
  };

  const removeAt = (idx) => {
    const newArr = [...rawSkills];
    newArr.splice(idx, 1);
    onChange(rowId, newArr);
  };

  const editAt = (idx) => {
    const newArr = [...rawSkills];
    const tokenToEdit = newArr.splice(idx, 1)[0];
    onChange(rowId, newArr);
    
    if (inputValue.trim()) {
      setInputValue(inputValue + ", " + tokenToEdit);
    } else {
      setInputValue(tokenToEdit);
    }
    
    setTimeout(() => document.getElementById(`input-${rowId}`)?.focus(), 0);
  };

  return (
    <div
      className="cell-input"
      onClick={() => document.getElementById(`input-${rowId}`)?.focus()}
    >
      {rawSkills.map((token, idx) => {
        let displayName = token;
        let displayLevel = null;

        // Check if the user manually appended a level like (L0.5), (l1), or (L0.5, L0.5)
        const manualMatch = token.match(/\(l\s*([\d.,\sL]+)\)$/i);
        if (manualMatch) {
          displayName = token
            .substring(0, token.length - manualMatch[0].length)
            .trim();
          displayLevel = `(L${manualMatch[1]})`;
        }

        // Always check library first for official level, using the base skill name
        const found = library.find(
          (s) => s.name.toLowerCase() === displayName.toLowerCase(),
        );
        if (found) {
          displayLevel = `(L${found.level})`;
        }

        return (
          <span key={idx} className="skill-token">
            <span 
              className="skill-token-name" 
              style={{ cursor: "pointer" }} 
              onClick={(e) => { 
                e.stopPropagation(); 
                editAt(idx); 
              }}
              title="Click to edit"
            >
              {displayName}
            </span>
            {displayLevel && (
              <span className="skill-token-level">{displayLevel}</span>
            )}
            <button
              className="skill-token-delete"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(idx);
              }}
              title="Remove item"
            >
              <X size={12} />
            </button>
            {(idx < rawSkills.length - 1 || inputValue.length > 0) && (
              <span className="skill-token-comma">, </span>
            )}
          </span>
        );
      })}

      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          minWidth: "150px",
        }}
      >
        <input
          id={`input-${rowId}`}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={
            rawSkills.length === 0
              ? "Type skills here (separated by comma)..."
              : ""
          }
          style={{
            background: "transparent",
            zIndex: 1,
            position: "relative",
            width: "100%",
          }}
        />
        {prediction && inputValue.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              color: "#cbd5e1",
              pointerEvents: "none",
              zIndex: 0,
              whiteSpace: "pre",
              fontSize: "0.95rem",
              fontWeight: 500,
              paddingLeft: 0,
              fontFamily: "inherit",
            }}
          >
            <span style={{ visibility: "hidden" }}>{inputValue}</span>
            <span>{predictionRemainder}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState("library");
  const [contextMenu, setContextMenu] = useState(null);
  const [printRoutineId, setPrintRoutineId] = useState(null);




  // Skills
  const [skills, setSkills] = useCloudSyncState("skills", "ijru_skills", DEFAULT_SKILLS);

  // Routines
  const [routines, setRoutines] = useCloudSyncState("routines", "ijru_routines", DEFAULT_ROUTINES);
  const [activeRoutineId, setActiveRoutineId] = useState(null);

  // Skill Form State
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    level: "1",
    category: "Rope Manipulation",
    subcategory: "Basic/Wrap",
    description: "",
    socialLink: "",
  });

  const [videoUrl, setVideoUrl] = useState(null);
  
  // Ref for auto-scrolling
  const addRowBtnRef = useRef(null);
  const activeRoutine = routines.find(r => r.id === activeRoutineId);
  const rowCount = activeRoutine?.rows.length || 0;
  const lastRowCount = useRef(rowCount);
  const lastActiveRoutineId = useRef(activeRoutineId);

  useEffect(() => {
    // Only auto-scroll if we are in the same routine and the row count increased (a row was added)
    if (activeRoutineId && activeRoutineId === lastActiveRoutineId.current && rowCount > lastRowCount.current) {
      setTimeout(() => {
        addRowBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    lastRowCount.current = rowCount;
    lastActiveRoutineId.current = activeRoutineId;
  }, [rowCount, activeRoutineId]);

  const getEmbedUrl = (url) => {
    if (!url) return null;
    try {
      // YouTube
      const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|^shorts\/|youtube.com\/shorts\/)([^#&?]*).*/;

      const match = url.match(ytRegExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
      }
    } catch (e) {
      console.warn("Embed parsing error:", e);
    }
    return null;
  };



  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      level: "1",
      category: "Rope Manipulation",
      subcategory: "Basic/Wrap",
      description: "",
      socialLink: "",
    });
    setIsModalOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setVideoUrl(null);
        resetForm();
        setContextMenu(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const openNewSkillForm = () => {
    resetForm();
    const levelVal = filterLevel !== "All" ? filterLevel : "1";
    const categoryVal =
      filterCategory !== "All" ? filterCategory : "Rope Manipulation";
    const subcategoryVal = CATEGORIES[categoryVal][0] || "";
    setFormData((prev) => ({
      ...prev,
      level: levelVal,
      category: categoryVal,
      subcategory: subcategoryVal,
    }));
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "category") {
      const firstSub = CATEGORIES[value][0] || "";
      setFormData((prev) => ({
        ...prev,
        category: value,
        subcategory: firstSub,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const skillName = formData.name.trim();
    if (!skillName) return;

    if (formData.id) {
      const isDuplicate = skills.some(
        (s) =>
          s.name.toLowerCase() === skillName.toLowerCase() &&
          s.id !== formData.id,
      );
      if (isDuplicate) {
        alert("A skill with this name already exists in the library!");
        return;
      }
      setSkills(
        skills.map((s) =>
          s.id === formData.id ? { ...formData, name: skillName } : s,
        ),
      );
    } else {
      const isDuplicate = skills.some(
        (s) => s.name.toLowerCase() === skillName.toLowerCase(),
      );
      if (isDuplicate) {
        alert("A skill with this name already exists in the library!");
        return;
      }
      setSkills([
        { ...formData, name: skillName, id: crypto.randomUUID() },
        ...skills,
      ]);
    }
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this skill?"))
      setSkills(skills.filter((s) => s.id !== id));
  };

  const handleEdit = (skill) => {
    setFormData(skill);
    setIsModalOpen(true);
  };

  // Routine Handlers
  const createNewRoutine = () => {
    const newId = crypto.randomUUID();
    const newRoutine = {
      id: newId,
      name: "NEW STUDENT NAME",
      info: "",
      rows: [{ id: crypto.randomUUID(), rawSkills: [] }],
    };
    setRoutines([newRoutine, ...routines]);
    setActiveRoutineId(newId);
  };

  const updateRoutineName = (val) => {
    setRoutines(
      routines.map((r) => (r.id === activeRoutineId ? { ...r, name: val } : r)),
    );
  };

  const updateRoutineInfo = (val) => {
    setRoutines(
      routines.map((r) => (r.id === activeRoutineId ? { ...r, info: val } : r)),
    );
  };

  const addRow = () => {
    setRoutines(
      routines.map((r) => {
        if (r.id === activeRoutineId)
          return {
            ...r,
            rows: [...r.rows, { id: crypto.randomUUID(), rawSkills: [] }],
          };
        return r;
      }),
    );
  };

  const deleteRow = (rowId) => {
    setRoutines(
      routines.map((r) => {
        if (r.id === activeRoutineId)
          return { ...r, rows: r.rows.filter((row) => row.id !== rowId) };
        return r;
      }),
    );
  };

  const updateRowSkills = (rowId, newRawSkills) => {
    setRoutines(
      routines.map((r) => {
        if (r.id === activeRoutineId) {
          return {
            ...r,
            rows: r.rows.map((row) => {
              if (row.id === rowId) return { ...row, rawSkills: newRawSkills };
              return row;
            }),
          };
        }
        return r;
      }),
    );
  };

  const deleteRoutine = (id) => {
    if (window.confirm("Delete this student routine?")) {
      setRoutines(routines.filter((r) => r.id !== id));
      if (activeRoutineId === id) setActiveRoutineId(null);
    }
  };

  // Preprocessing
  const filteredSkills = skills
    .filter((skill) => {
      const matchesLevel = filterLevel === "All" || skill.level === filterLevel;
      const matchesCategory =
        filterCategory === "All" || skill.category === filterCategory;
      const matchesSearch =
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLevel && matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const levelA = parseFloat(a.level) || 0;
      const levelB = parseFloat(b.level) || 0;
      if (levelA !== levelB) return levelA - levelB;
      const subA = a.subcategory || "";
      const subB = b.subcategory || "";
      const subCompare = subA.localeCompare(subB);
      if (subCompare !== 0) return subCompare;
      return a.name.localeCompare(b.name);
    });

  return (
    <>
    {!printRoutineId && (
    <div className="app-container">
      {activeTab === "library" && (
        <header>
          <div className="logo-container">
            <div className="logo-icon">
              <Activity size={28} />
            </div>
            <h1>Jump Rope Studio</h1>
          </div>
          <div
            className="text-muted"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Trophy size={18} color="var(--accent-secondary)" />
            {skills.length} Skills Logged
          </div>
        </header>
      )}

      {/* TABS */}
      {!activeRoutineId && (
        <div className="tabs-container">
          <div className="tabs-left">
            <button
              className={`tab-btn ${activeTab === "library" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("library");
                setActiveRoutineId(null);
              }}
            >
              <BookOpen size={20} /> Skill Library
            </button>
            <button
              className={`tab-btn ${activeTab === "routines" ? "active" : ""}`}
              onClick={() => setActiveTab("routines")}
            >
              <Users size={20} /> Student Routines
            </button>
          </div>
          {activeTab === "routines" && (
            <button
              className="btn btn-primary"
              style={{ padding: "0.4rem 1rem", fontSize: "0.9rem" }}
              onClick={createNewRoutine}
            >
              <Plus size={16} /> Create New Routine
            </button>
          )}
        </div>
      )}

      <main className="main-content">
        {/* =======================
            TAB 1: SKILL LIBRARY
            ======================= */}
        {activeTab === "library" && (
          <div className="animate-fade-in">
            <div className="controls-bar">
              <div className="filters-group">
                <div className="form-group" style={{ flex: "1.5" }}>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={18}
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "14px",
                        color: "var(--text-secondary)",
                      }}
                    />
                    <input
                      type="text"
                      style={{ paddingLeft: "38px" }}
                      placeholder="Search skills by name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                  >
                    <option value="All">All Levels</option>
                    {LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Level {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {Object.keys(CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="controls-actions">
                <button
                  className="btn btn-primary"
                  onClick={openNewSkillForm}
                  style={{ margin: 0 }}
                >
                  <Plus size={20} /> Add New Skill
                </button>
              </div>
            </div>

            {filteredSkills.length === 0 ? (
              <div className="empty-state animate-fade-in">
                <div className="empty-state-icon">
                  <FileSpreadsheet size={48} />
                </div>
                <h3>No skills found</h3>
                <p>
                  Try adjusting your search filters or click "Add New Skill" to
                  populate your library.
                </p>
              </div>
            ) : (
              <div className="table-container animate-fade-in">
                <table>
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Skill Name</th>
                      <th>Category</th>
                      <th>Subcategory</th>
                      <th>Description</th>
                      <th>Media Link</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSkills.map((skill) => (
                      <tr key={skill.id}>
                        <td>
                          <span className="badge badge-level">
                            Lvl {skill.level}
                          </span>
                        </td>
                        <td className="cell-name">{skill.name}</td>
                        <td>
                          <span className="badge badge-category">
                            {skill.category}
                          </span>
                        </td>
                        <td>
                          {skill.subcategory ? (
                            <span className="badge badge-sub">
                              {skill.subcategory}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="cell-desc" title={skill.description}>
                          {skill.description || (
                            <span className="text-muted italic">None</span>
                          )}
                        </td>
                        <td>
                          {skill.socialLink ? (
                            <button
                              onClick={() => setVideoUrl(skill.socialLink)}
                              className="table-link-btn"
                              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", color: "var(--accent-primary)", padding: 0 }}
                            >
                              <PlaySquare size={16} /> View
                            </button>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>

                        <td>
                          <div className="actions-cell">
                            <button
                              className="btn-icon"
                              onClick={() => handleEdit(skill)}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="btn-icon btn-danger"
                              onClick={() => handleDelete(skill.id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* =======================
            TAB 2: STUDENT ROUTINES
            ======================= */}
        {activeTab === "routines" && !activeRoutineId && (
          <div className="animate-fade-in">
            {routines.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Users size={48} />
                </div>
                <h3>No student routines</h3>
                <p>
                  Click "Create New Routine" above to start assigning skills.
                </p>
              </div>
            ) : (
              <div className="routine-picker-grid">
                {routines.map((r) => (
                  <div
                    key={r.id}
                    className="routine-card-compact"
                    onClick={() => setPrintRoutineId(r.id)}
                  >
                    <div className="routine-card-left">
                      <BookOpen size={18} color="var(--accent-primary)" />
                      <span className="routine-card-title">{r.name}</span>
                    </div>
                    <div className="routine-card-right">
                      <span className="badge badge-sub">
                        {r.rows.length} Rows
                      </span>
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            mouseX: e.clientX,
                            mouseY: e.clientY,
                            routineId: r.id
                          });
                        }}
                        title="Options"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXCEL-LIKE BUILDER VIEW */}
        {activeTab === "routines" &&
          activeRoutineId &&
          (() => {
            const activeRoutine = routines.find(
              (r) => r.id === activeRoutineId,
            );
            if (!activeRoutine) return null;

            return (
              <div className="animate-fade-in">
                <div className="routine-header-card">
                  <button
                    className="btn-icon"
                    onClick={() => setActiveRoutineId(null)}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div
                    className="routine-title-wrapper"
                    style={{ flexWrap: "wrap", alignItems: "flex-start" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.8rem",
                        flex: 1,
                        minWidth: "300px",
                      }}
                    >
                      <span className="routine-title-label">NAME:</span>
                      <input
                        type="text"
                        className="routine-title-input"
                        style={{ fontSize: "1rem" }}
                        value={activeRoutine.name}
                        onChange={(e) => updateRoutineName(e.target.value)}
                        placeholder="Enter student name(s)..."
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.8rem",
                        flex: 1,
                        minWidth: "300px",
                      }}
                    >
                      <span
                        className="routine-title-label"
                        style={{ marginTop: "0.5rem" }}
                      >
                        INFO:
                      </span>
                      <textarea
                        className="routine-title-input"
                        style={{
                          fontSize: "0.9rem",
                          minHeight: "60px",
                          resize: "vertical",
                          lineHeight: "1.4",
                        }}
                        value={activeRoutine.info || ""}
                        onChange={(e) => updateRoutineInfo(e.target.value)}
                        placeholder="Add team names, context, or notes here..."
                      />
                    </div>
                  </div>
                </div>

                <h2 style={{ fontSize: "1.25rem" }}>SKILL LIST</h2>

                <table className="excel-row-table">
                  <thead>
                    <tr>
                      <th style={{ width: "50px", textAlign: "center" }}>
                        ROW
                      </th>
                      <th>SKILLS (Type & hit comma)</th>
                      <th style={{ width: "60px", textAlign: "center" }}>
                        DELETE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRoutine.rows.map((row, rowIndex) => {
                      // Backwards compatibility safety catch
                      const rawSkills = row.rawSkills || row.skillIds || [];

                      return (
                        <tr key={row.id}>
                          <td className="cell-number">{rowIndex + 1}</td>
                          <td>
                            <SkillRowInput
                              rowId={row.id}
                              rawSkills={rawSkills}
                              onChange={updateRowSkills}
                              library={skills}
                            />
                          </td>
                          <td className="cell-actions">
                            <button
                              className="btn-icon btn-danger"
                              onClick={() => deleteRow(row.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <button
                  ref={addRowBtnRef}
                  className="btn"
                  style={{
                    marginTop: "1rem",
                    border: "1px dashed var(--glass-border)",
                  }}
                  onClick={addRow}
                >
                  <Plus size={18} /> Add New Row
                </button>
              </div>
            );
          })()}
      </main>

      {/* Modal for Add / Edit Skill Library */}
      <div className={`modal-overlay ${isModalOpen ? "active" : ""}`}>
        <div className="modal-content">
          <button className="modal-close" onClick={resetForm}>
            <X size={24} />
          </button>
          <h2>
            {formData.id ? <Edit2 size={24} /> : <Plus size={24} />}{" "}
            {formData.id ? "Edit Skill" : "Add New Skill"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Skill Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Level</label>
                <select
                  name="level"
                  value={formData.level}
                  onChange={handleInputChange}
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  {Object.keys(CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {CATEGORIES[formData.category].length > 0 && (
              <div className="form-group animate-fade-in">
                <label>Subcategory</label>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                >
                  {CATEGORIES[formData.category].map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Social Media / Video Link</label>
              <input
                type="url"
                name="socialLink"
                value={formData.socialLink || ""}
                onChange={handleInputChange}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "1rem" }}
            >
              <Save size={20} /> {formData.id ? "Update Skill" : "Save Skill"}
            </button>
          </form>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
        >
          <div 
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setActiveRoutineId(contextMenu.routineId);
              setContextMenu(null);
            }}
          >
            <BookOpen size={16} /> Edit Routine
          </div>
          <div 
            className="context-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              deleteRoutine(contextMenu.routineId);
              setContextMenu(null);
            }}
          >
            <Trash2 size={16} /> Delete Routine
          </div>
        </div>
      )}
    </div>
    )}
    
    {/* PDF / PRINT VIEW */}
    {printRoutineId && (() => {
      const r = routines.find(rout => rout.id === printRoutineId);
      if (!r) return null;
      return (
        <div className="pdf-view-container" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%', fontFamily: 'sans-serif' }}>
          
          <div className="no-print" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button className="btn" onClick={() => setPrintRoutineId(null)}>← Back to App</button>
            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
          </div>

          <div style={{ marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', marginBottom: '10px', alignItems: 'baseline' }}>
               <strong style={{ width: '80px', color: '#666' }}>NAME:</strong>
               <h1 style={{ fontSize: '24px', margin: 0, color: 'black' }}>{r.name}</h1>
            </div>
            {r.info && (
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                 <strong style={{ width: '80px', color: '#666' }}>INFO:</strong>
                 <p style={{ fontSize: '16px', color: '#333', margin: 0 }}>{r.info}</p>
              </div>
            )}
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr>
                 <th style={{ border: '1px solid #ccc', padding: '12px', width: '60px', textAlign: 'center', background: '#f8f9fa' }}>ROW</th>
                 <th style={{ border: '1px solid #ccc', padding: '12px', textAlign: 'left', background: '#f8f9fa' }}>SKILLS</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row, rowIndex) => {
                 const rawSkills = row.rawSkills || row.skillIds || [];
                 return (
                  <tr key={row.id}>
                    <td style={{ border: '1px solid #ccc', padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                      {rowIndex + 1}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '12px', lineHeight: '1.6' }}>
                      {rawSkills.map((token, idx) => {
                         let displayName = token.trim();
                         let displayLevel = null;

                         const manualMatch = displayName.match(/\(l\s*([\d.,\sL]+)\)$/i);
                         if (manualMatch) {
                           displayName = displayName.substring(0, displayName.length - manualMatch[0].length).trim();
                           displayLevel = `(L${manualMatch[1]})`;
                         }

                         const found = skills.find(s => s.name.toLowerCase() === displayName.toLowerCase());
                         if (found) {
                           displayLevel = `(L${found.level})`;
                         }

                         return (
                           <span key={idx} style={{ display: 'inline-block' }}>
                             <span style={{ fontWeight: 500, color: 'black' }}>{displayName}</span>
                             {displayLevel && <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: '4px' }}>{displayLevel}</span>}
                             {idx < rawSkills.length - 1 && <span style={{ marginRight: '8px', color: 'black' }}>,</span>}
                           </span>
                         );
                      })}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      );
    })()}

    {/* Video Pop-out Modal */}
    {videoUrl && (
      <div className="modal-overlay active" onClick={() => setVideoUrl(null)}>
        <div 
          className="modal-content video-modal-content" 
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '800px', width: '95%', padding: '2rem' }}
        >
          <button className="modal-close" onClick={() => setVideoUrl(null)}>
            <X size={24} />
          </button>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PlaySquare size={24} color="var(--accent-primary)" />
              Skill Demonstration
            </h2>
          </div>

          <div className="video-container" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', background: '#000' }}>
            {getEmbedUrl(videoUrl) ? (
              <iframe
                src={getEmbedUrl(videoUrl)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video player"
              ></iframe>
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: '20px' }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>This link cannot be embedded directly.</p>
                <a 
                  href={videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  View on External Site
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>

  );
}

export default App;
