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
  ChevronUp,
  ChevronDown,
  RotateCcw,
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
const DEFAULT_MODIFIERS = [
  { id: "mod-1", name: "Double 1", value: "L1, L1", socialLink: "", categories: ["Rope Manipulation"], subcategories: ["Basic/Wrap"] },
  { id: "mod-2", name: "Triple 1", value: "L1, L1, L1", socialLink: "", categories: ["Rope Manipulation"], subcategories: ["Basic/Wrap"] },
  { id: "mod-3", name: "Modified 2", value: "L1, L1, L2", socialLink: "", categories: ["Rope Manipulation"], subcategories: ["Basic/Wrap"] },
];

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
        setDoc(doc(db, "app_data", docName), { items: seedData }).catch((e) =>
          console.warn("Seed error:", e),
        );
        setIsLoaded(true);
      }
    });
    return unsub;
  }, [docName, localKey, defaultVal]);

  const updateState = React.useCallback(
    (newValOrUpdater) => {
      setState((prev) => {
        const newVal =
          typeof newValOrUpdater === "function"
            ? newValOrUpdater(prev)
            : newValOrUpdater;
        localStorage.setItem(localKey, JSON.stringify(newVal));
        setDoc(doc(db, "app_data", docName), { items: newVal }).catch((e) =>
          console.warn("Firestore error (enable database in console):", e),
        );
        return newVal;
      });
    },
    [docName, localKey],
  );

  return [state, updateState, isLoaded];
}

// Component purely for the inline typing experience
const SkillRowInput = ({ rowId, rawSkills = [], onChange, library, modifiers = [] }) => {
  const [inputValue, setInputValue] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState("");

  const normalize = (str) => {
    if (!str) return "";
    // Remove (L...) levels if present to match base skill name
    const base = str.replace(/\(l\s*[\d.,\sL-]+\)$/i, "").trim();
    return base.toLowerCase().replace(/[^a-z0-9]/g, "");
  };

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

  const getCorrectedToken = (val) => {
    const normVal = normalize(val);
    if (!normVal) return val;

    // Check library skills first
    const skillMatch = library.find(s => normalize(s.name) === normVal);
    if (skillMatch) return skillMatch.name;

    // Check modifiers
    const modMatch = modifiers.find(m => normalize(m.name) === normVal);
    if (modMatch) return `${modMatch.name} ${modMatch.value}`;

    return val;
  };

  const addToken = (val) => {
    const parts = parseTokens(val);
    if (parts.length > 0) {
      const correctedParts = parts.map(p => getCorrectedToken(p));
      onChange(rowId, [...rawSkills, ...correctedParts]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "," || e.key === "Enter") {
      // Bracket-aware comma check: only tokenize if all brackets are closed
      if (e.key === ",") {
        const openCount = (inputValue.match(/\(/g) || []).length;
        const closedCount = (inputValue.match(/\)/g) || []).length;
        if (openCount > closedCount) return;
      }

      e.preventDefault();
      if (inputValue.trim()) {
        addToken(inputValue);
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

  const startEditing = (idx) => {
    setEditingIdx(idx);
    setEditValue(rawSkills[idx]);
    setTimeout(
      () => document.getElementById(`edit-${rowId}-${idx}`)?.focus(),
      0,
    );
  };

  const finishEditing = (idx) => {
    if (editingIdx === null) return;
    const newArr = [...rawSkills];
    const trimmed = editValue.trim();
    if (trimmed) {
      newArr[idx] = getCorrectedToken(trimmed);
    } else {
      newArr.splice(idx, 1);
    }
    onChange(rowId, newArr);
    setEditingIdx(null);
    setEditValue("");
  };

  const handleEditKeyDown = (e, idx) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      finishEditing(idx);
    } else if (e.key === "Escape") {
      setEditingIdx(null);
      setEditValue("");
    }
  };

  const reorderTokens = (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    const newArr = [...rawSkills];
    const [moved] = newArr.splice(dragIdx, 1);
    newArr.splice(dropIdx, 0, moved);
    onChange(rowId, newArr);
  };

  return (
    <div
      className="cell-input"
      onClick={() => document.getElementById(`input-${rowId}`)?.focus()}
    >
      {rawSkills.map((token, idx) => {
        if (editingIdx === idx) {
          return (
            <input
              key={idx}
              id={`edit-${rowId}-${idx}`}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, idx)}
              onBlur={() => finishEditing(idx)}
              className="inline-edit-input"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: `${Math.max(editValue.length, 5)}ch`,
              }}
            />
          );
        }

        let displayName = token;
        let displayLevel = null;

        // Check if the user manually appended a level like (L0.5), (l1), or (L0.5, L0.5)
        const manualMatch = token.match(/\(l\s*([\d.,\sL-]+)\)$/i);
        if (manualMatch) {
          displayName = token
            .substring(0, token.length - manualMatch[0].length)
            .trim();
          displayLevel = `(L${manualMatch[1]})`;
        }

        // Always check library first for official level, using normalized name matching
        const normName = normalize(displayName);
        const found = library.find(
          (s) => normalize(s.name) === normName,
        );
        if (found) {
          displayLevel = `(L${found.level})`;
          // Also check if the token itself needs correction (though addToken handles this, 
          // direct edits or legacy data might still be uncorrected)
          displayName = found.name;
        }

        return (
          <div
            key={idx}
            className="skill-token"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-skill-token", idx);
              e.dataTransfer.effectAllowed = "move";
              e.currentTarget.classList.add("dragging-token");
              e.stopPropagation();
            }}
            onDragEnd={(e) => {
              e.currentTarget.classList.remove("dragging-token");
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const data = e.dataTransfer.getData("application/x-skill-token");
              if (data) {
                const dragIdx = parseInt(data, 10);
                reorderTokens(dragIdx, idx);
              }
            }}
            style={{ cursor: "grab" }}
          >
            <span
              className="skill-token-name"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                startEditing(idx);
              }}
              title="Click to edit / Drag to reorder"
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
            {idx < rawSkills.length - 1 && (
              <span className="skill-token-comma">, </span>
            )}
          </div>
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
          className="main-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={
            rawSkills.length === 0
              ? "Type skills here (separated by comma)..."
              : ""
          }
          autoComplete="off"
        />
      </div>
    </div>
  );
};


function App() {
  const [activeTab, setActiveTab] = useState("library");
  const [contextMenu, setContextMenu] = useState(null);
  const [printRoutineId, setPrintRoutineId] = useState(null);

  // Skills
  const [skills, setSkills] = useCloudSyncState(
    "skills",
    "ijru_skills",
    DEFAULT_SKILLS,
  );

  const [routines, setRoutines] = useCloudSyncState(
    "routines",
    "ijru_routines",
    DEFAULT_ROUTINES,
  );
  const [modifiers, setModifiers] = useCloudSyncState(
    "modifiers",
    "ijru_modifiers",
    DEFAULT_MODIFIERS,
  );
  const [routinesHistory, setRoutinesHistory] = useState([]);
  const [activeRoutineId, setActiveRoutineId] = useState(null);

  const saveToHistory = React.useCallback(() => {
    setRoutinesHistory(prev => [JSON.stringify(routines), ...prev].slice(0, 50));
  }, [routines]);

  const undo = React.useCallback(() => {
    if (routinesHistory.length === 0) return;
    const [lastState, ...rest] = routinesHistory;
    setRoutines(JSON.parse(lastState));
    setRoutinesHistory(rest);
  }, [routinesHistory, setRoutines]);

  useEffect(() => {
    const handleUndoKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (activeTab === 'routines') {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleUndoKey);
    return () => window.removeEventListener('keydown', handleUndoKey);
  }, [activeTab, undo]);


  // Skill Form State
  const [filterLevel, setFilterLevel] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterSubcategory, setFilterSubcategory] = useState("All");
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

  const [modifierFormData, setModifierFormData] = useState({
    id: "",
    name: "",
    value: "",
    socialLink: "",
    categories: [],
    subcategories: [],
  });
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [modifierSearchTerm, setModifierSearchTerm] = useState("");
  const [modifierFilterCategory, setModifierFilterCategory] = useState("All");
  const [modifierFilterSubcategory, setModifierFilterSubcategory] = useState("All");

  const [videoUrl, setVideoUrl] = useState(null);

  // Ref for auto-scrolling
  const addRowBtnRef = useRef(null);
  const activeRoutine = routines.find((r) => r.id === activeRoutineId);
  const rowCount = activeRoutine?.rows.length || 0;
  const lastRowCount = useRef(rowCount);
  const lastActiveRoutineId = useRef(activeRoutineId);

  useEffect(() => {
    // Only auto-scroll if we are in the same routine and the row count increased (a row was added)
    if (
      activeRoutineId &&
      activeRoutineId === lastActiveRoutineId.current &&
      rowCount > lastRowCount.current
    ) {
      setTimeout(() => {
        // Scroll the "Add New Row" button into view (at the bottom)
        addRowBtnRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });

        // Also focus the first input of the new row for better UX
        const lastRow = activeRoutine?.rows[rowCount - 1];
        if (lastRow) {
          document.getElementById(`input-${lastRow.id}`)?.focus();
        }
      }, 150);
    }
    lastRowCount.current = rowCount;
    lastActiveRoutineId.current = activeRoutineId;
  }, [rowCount, activeRoutineId, activeRoutine?.rows]);

  const getEmbedUrl = (url) => {
    if (!url) return null;
    try {
      // YouTube
      const ytRegExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|^shorts\/|youtube.com\/shorts\/)([^#&?]*).*/;

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
    const subcategoryVal = 
      filterSubcategory !== "All" ? filterSubcategory : (CATEGORIES[categoryVal][0] || "");
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

  // Modifier Handlers
  const resetModifierForm = () => {
    setModifierFormData({
      id: "",
      name: "",
      value: "",
      socialLink: "",
      categories: [],
      subcategories: [],
    });
    setIsModifierModalOpen(false);
  };

  const openNewModifierForm = () => {
    resetModifierForm();
    setIsModifierModalOpen(true);
  };

  const handleModifierInputChange = (e) => {
    const { name, value } = e.target;
    setModifierFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleModifierCategory = (cat) => {
    setModifierFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const toggleModifierSubcategory = (sub) => {
    setModifierFormData((prev) => ({
      ...prev,
      subcategories: prev.subcategories.includes(sub)
        ? prev.subcategories.filter((s) => s !== sub)
        : [...prev.subcategories, sub],
    }));
  };

  const handleModifierSubmit = (e) => {
    e.preventDefault();
    const modName = modifierFormData.name.trim();
    if (!modName) return;

    if (modifierFormData.id) {
      setModifiers(
        modifiers.map((m) =>
          m.id === modifierFormData.id ? { ...modifierFormData, name: modName } : m,
        ),
      );
    } else {
      setModifiers([
        { ...modifierFormData, name: modName, id: crypto.randomUUID() },
        ...modifiers,
      ]);
    }
    resetModifierForm();
  };

  const handleModifierDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this modifier?"))
      setModifiers(modifiers.filter((m) => m.id !== id));
  };

  const handleModifierEdit = (mod) => {
    setModifierFormData(mod);
    setIsModifierModalOpen(true);
  };

  // Routine Handlers
  const createNewRoutine = () => {
    setRoutinesHistory([]); // Clear any old history from other routines
    saveToHistory();
    const newId = crypto.randomUUID();
    const newRoutine = {
      id: newId,
      name: "",
      info: "",
      rows: [{ id: crypto.randomUUID(), rawSkills: [] }],
    };
    setRoutines([newRoutine, ...routines]);
    setActiveRoutineId(newId);
  };

  const updateRoutineName = (val) => {
    saveToHistory();
    setRoutines(
      routines.map((r) => (r.id === activeRoutineId ? { ...r, name: val } : r)),
    );
  };

  const updateRoutineInfo = (val) => {
    saveToHistory();
    setRoutines(
      routines.map((r) => (r.id === activeRoutineId ? { ...r, info: val } : r)),
    );
  };

  const addRow = () => {
    saveToHistory();
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
    saveToHistory();
    setRoutines(
      routines.map((r) => {
        if (r.id === activeRoutineId)
          return { ...r, rows: r.rows.filter((row) => row.id !== rowId) };
        return r;
      }),
    );
  };

  const updateRowSkills = (rowId, newRawSkills) => {
    // Only save history if we're not inside the typing logic (which updates on every key if we're not careful)
    // Actually SkillRowInput handles the final onChange, so this is the right place.
    saveToHistory();
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
      saveToHistory();
      setRoutines(routines.filter((r) => r.id !== id));
      if (activeRoutineId === id) setActiveRoutineId(null);
    }
  };

  const reorderRoutines = (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    saveToHistory();
    const newRoutines = [...routines];
    const [moved] = newRoutines.splice(dragIdx, 1);
    newRoutines.splice(dropIdx, 0, moved);
    setRoutines(newRoutines);
  };

  const reorderRows = (dragIdx, dropIdx) => {
    if (dragIdx === dropIdx) return;
    saveToHistory();
    setRoutines(routines.map(r => {
      if (r.id === activeRoutineId) {
        const newRows = [...r.rows];
        const [moved] = newRows.splice(dragIdx, 1);
        newRows.splice(dropIdx, 0, moved);
        return { ...r, rows: newRows };
      }
      return r;
    }));
  };

  // Preprocessing
  const filteredSkills = skills
    .filter((skill) => {
      const matchesLevel = filterLevel === "All" || skill.level === filterLevel;
      const matchesCategory =
        filterCategory === "All" || skill.category === filterCategory;
      const matchesSubcategory =
        filterSubcategory === "All" || skill.subcategory === filterSubcategory;
      const matchesSearch =
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLevel && matchesCategory && matchesSubcategory && matchesSearch;
    })
    .sort((a, b) => {
      const levelA = parseFloat(a.level) || 0;
      const levelB = parseFloat(b.level) || 0;
      if (levelA !== levelB) return levelA - levelB;

      // Custom priority sorting for Multiples category based on description keywords
      if (a.category === "Multiples" && b.category === "Multiples") {
        const rotationPriority = {
          SEPTUPLE: 7,
          SEXTUPLE: 6,
          QUINTUPLE: 5,
          QUADRUPLE: 4,
          TRIPLE: 3,
          DOUBLE: 2,
          SINGLE: 1,
        };
        const getPriority = (skill) => {
          const desc = (skill.description || "").toUpperCase();
          // Check from highest to lowest to avoid partial matches if any
          for (const [key, priority] of Object.entries(rotationPriority)) {
            if (desc.includes(key)) return priority;
          }
          return 99;
        };
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
      }

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
          {(activeTab === "library" || activeTab === "modifiers") && (
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
                {activeTab === "library" 
                  ? `${skills.length} Skills Logged` 
                  : `${modifiers.length} Modifiers Logged`}
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
                    setRoutinesHistory([]);
                  }}
                >
                  <BookOpen size={20} /> Skill Library
                </button>
                <button
                  className={`tab-btn ${activeTab === "modifiers" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("modifiers");
                    setRoutinesHistory([]);
                  }}
                >
                  <Activity size={20} /> Modifiers Library
                </button>
                <button
                  className={`tab-btn ${activeTab === "routines" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("routines");
                    setRoutinesHistory([]);
                  }}
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
                        onChange={(e) => {
                          setFilterCategory(e.target.value);
                          setFilterSubcategory("All");
                        }}
                      >
                        <option value="All">All Categories</option>
                        {Object.keys(CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <select
                        value={filterSubcategory}
                        onChange={(e) => setFilterSubcategory(e.target.value)}
                      >
                        <option value="All">All Subcategories</option>
                        {filterCategory !== "All" &&
                          CATEGORIES[filterCategory]?.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
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
                      Try adjusting your search filters or click "Add New Skill"
                      to populate your library.
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
                                L{skill.level}
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
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    color: "var(--accent-primary)",
                                    padding: 0,
                                  }}
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
                      Click "Create New Routine" above to start assigning
                      skills.
                    </p>
                  </div>
                ) : (
                  <div className="routine-picker-grid">
                {routines.map((r, idx) => (
                  <div
                    key={r.id}
                    className="routine-card-compact"
                    onClick={() => setPrintRoutineId(r.id)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-routine-card", idx);
                      e.dataTransfer.effectAllowed = "move";
                      e.currentTarget.classList.add('dragging');
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.classList.remove('dragging');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const data = e.dataTransfer.getData("application/x-routine-card");
                      if (data) {
                        const dragIdx = parseInt(data, 10);
                        reorderRoutines(dragIdx, idx);
                      }
                    }}
                    style={{ cursor: 'grab' }}
                  >
                        <div className="routine-card-left">
                          <BookOpen size={18} color="var(--accent-primary)" />
                          <span className="routine-card-title">{r.name}</span>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* =======================
            TAB 3: MODIFIERS LIBRARY
            ======================= */}
            {activeTab === "modifiers" && (
              <div className="animate-fade-in">
                <div className="controls-bar">
                  <div className="filters-group">
                    <div className="form-group" style={{ flex: "2" }}>
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
                          placeholder="Search modifiers by name or value..."
                          value={modifierSearchTerm}
                          onChange={(e) => setModifierSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <select
                        value={modifierFilterCategory}
                        onChange={(e) => {
                          setModifierFilterCategory(e.target.value);
                          setModifierFilterSubcategory("All");
                        }}
                      >
                        <option value="All">All Categories</option>
                        {Object.keys(CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <select
                        value={modifierFilterSubcategory}
                        onChange={(e) => setModifierFilterSubcategory(e.target.value)}
                      >
                        <option value="All">All Subcategories</option>
                        {modifierFilterCategory !== "All" &&
                          CATEGORIES[modifierFilterCategory]?.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="controls-actions">
                    <button
                      className="btn btn-primary"
                      onClick={openNewModifierForm}
                      style={{ margin: 0 }}
                    >
                      <Plus size={20} /> Add New Modifier
                    </button>
                  </div>
                </div>

                {(() => {
                  const filteredModifiers = modifiers.filter((mod) => {
                    const matchesCategory =
                      modifierFilterCategory === "All" ||
                      (mod.categories && mod.categories.includes(modifierFilterCategory));
                    const matchesSubcategory =
                      modifierFilterSubcategory === "All" ||
                      (mod.subcategories && mod.subcategories.includes(modifierFilterSubcategory));
                    const matchesSearch =
                      mod.name.toLowerCase().includes(modifierSearchTerm.toLowerCase()) ||
                      mod.value.toLowerCase().includes(modifierSearchTerm.toLowerCase());
                    return matchesCategory && matchesSubcategory && matchesSearch;
                  });

                  if (filteredModifiers.length === 0) {
                    return (
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Activity size={48} />
                        </div>
                        <h3>No modifiers found</h3>
                        <p>
                          {modifierSearchTerm 
                            ? "Try adjusting your search term."
                            : 'Click "Add New Modifier" above to define complex level strings for your routines.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                  <div className="table-container animate-fade-in" style={{ marginTop: '1rem' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>MODIFIER SKILL NAME</th>
                          <th>CATEGORIES</th>
                          <th>SUB CATEGORIES</th>
                          <th>MODIFIER LEVEL</th>
                          <th>MEDIA LINK</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModifiers.map((mod) => (
                          <tr key={mod.id}>
                            <td className="cell-name">{mod.name}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                {(mod.categories || []).map(cat => (
                                  <span key={cat} className="badge badge-category">{cat}</span>
                                ))}
                                {(!mod.categories || mod.categories.length === 0) && <span className="text-muted">-</span>}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                {(mod.subcategories || []).map(sub => (
                                  <span key={sub} className="badge badge-sub">{sub}</span>
                                ))}
                                {(!mod.subcategories || mod.subcategories.length === 0) && <span className="text-muted">-</span>}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-level">
                                {mod.value}
                              </span>
                            </td>
                            <td>
                              {mod.socialLink ? (
                                <button
                                  className="btn-icon"
                                  onClick={() => setVideoUrl(mod.socialLink)}
                                  style={{
                                    color: "var(--accent-primary)",
                                    fontSize: "0.8rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <PlaySquare size={14} /> View
                                </button>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  className="btn-icon"
                                  onClick={() => handleModifierEdit(mod)}
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  className="btn-icon btn-danger"
                                  onClick={() => handleModifierDelete(mod.id)}
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
                  );
                })()}
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
                        onClick={() => {
                          setActiveRoutineId(null);
                          setRoutinesHistory([]);
                        }}
                        title="Back"
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                      <h2 style={{ fontSize: "1.25rem", margin: 0 }}>SKILL LIST</h2>
                      {routinesHistory.length > 0 && (
                        <button
                          className="btn-icon"
                          onClick={undo}
                          style={{ 
                            color: 'var(--accent-primary)',
                            padding: '4px',
                            background: 'rgba(52, 152, 219, 0.1)',
                            borderRadius: '6px'
                          }}
                          title="Undo (Ctrl+Z)"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                    </div>

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
                            <tr 
                          key={row.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/x-routine-row", rowIndex);
                            e.dataTransfer.effectAllowed = "move";
                            e.currentTarget.classList.add('dragging-row');
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.classList.remove('dragging-row');
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const data = e.dataTransfer.getData("application/x-routine-row");
                            if (data) {
                              const dragIdx = parseInt(data, 10);
                              reorderRows(dragIdx, rowIndex);
                            }
                          }}
                        >
                          <td className="cell-number" style={{ cursor: 'grab' }}>{rowIndex + 1}</td>
                          <td>
                            <SkillRowInput
                              rowId={row.id}
                              rawSkills={rawSkills}
                              onChange={updateRowSkills}
                              library={skills}
                              modifiers={modifiers}
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
                    style={{ 
                      minHeight: "44px", 
                      height: "auto",
                      resize: "none",
                      overflow: "hidden" 
                    }}
                    rows={1}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    placeholder="Briefly describe the skill (will expand as you type)..."
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
                  <Save size={20} />{" "}
                  {formData.id ? "Update Skill" : "Save Skill"}
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
              setRoutinesHistory([]);
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
      {printRoutineId &&
        (() => {
          const r = routines.find((rout) => rout.id === printRoutineId);
          if (!r) return null;
          return (
            <div
              className="pdf-view-container"
              style={{
                padding: "40px",
                maxWidth: "1000px",
                margin: "0 auto",
                width: "100%",
                fontFamily: "sans-serif",
              }}
            >
              <div
                className="no-print"
                style={{
                  marginBottom: "20px",
                  display: "flex",
                  gap: "10px",
                  justifyContent: "space-between",
                  flexWrap: "wrap"
                }}
              >
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => setPrintRoutineId(null)}>
                    ← Back
                  </button>
                  <button 
                    className="btn" 
                    style={{ gap: "8px" }}
                    onClick={() => {
                      setActiveRoutineId(printRoutineId);
                      setPrintRoutineId(null);
                      setRoutinesHistory([]);
                    }}
                  >
                    <Edit2 size={18} /> Edit
                  </button>
                  <button 
                    className="btn btn-danger" 
                    style={{ gap: "8px" }}
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this routine?")) {
                        deleteRoutine(printRoutineId);
                        setPrintRoutineId(null);
                      }
                    }}
                  >
                    <Trash2 size={18} /> Delete
                  </button>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                >
                  🖨️ Print / Save as PDF
                </button>
              </div>

              <div
                style={{
                  marginBottom: "20px",
                  borderBottom: "2px solid #eee",
                  paddingBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    marginBottom: "10px",
                    alignItems: "baseline",
                  }}
                >
                  <strong style={{ width: "80px", color: "#666" }}>
                    NAME:
                  </strong>
                  <h1 style={{ fontSize: "24px", margin: 0, color: "black", WebkitTextFillColor: "black" }}>
                    {r.name || "Unnamed Routine"}
                  </h1>
                </div>
                {r.info && (
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <strong style={{ width: "80px", color: "#666" }}>
                      INFO:
                    </strong>
                    <p style={{ fontSize: "16px", color: "#333", margin: 0 }}>
                      {r.info}
                    </p>
                  </div>
                )}
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "20px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        border: "1px solid #ccc",
                        padding: "12px",
                        width: "60px",
                        textAlign: "center",
                        background: "#f8f9fa",
                      }}
                    >
                      ROW
                    </th>
                    <th
                      style={{
                        border: "1px solid #ccc",
                        padding: "12px",
                        textAlign: "left",
                        background: "#f8f9fa",
                      }}
                    >
                      SKILLS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((row, rowIndex) => {
                    const rawSkills = row.rawSkills || row.skillIds || [];
                    return (
                      <tr key={row.id}>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "bold",
                          }}
                        >
                          {rowIndex + 1}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ccc",
                            padding: "12px",
                            lineHeight: "1.6",
                          }}
                        >
                          {rawSkills.map((token, idx) => {
                            let displayName = token.trim();
                            let displayLevel = null;

                            const manualMatch = displayName.match(
                              /\(l\s*([\d.,\sL-]+)\)$/i,
                            );
                            if (manualMatch) {
                              displayName = displayName
                                .substring(
                                  0,
                                  displayName.length - manualMatch[0].length,
                                )
                                .trim();
                              displayLevel = `(L${manualMatch[1]})`;
                            }

                            const found = skills.find(
                              (s) =>
                                s.name.toLowerCase() ===
                                displayName.toLowerCase(),
                            );
                            if (found) {
                              displayLevel = `(L${found.level})`;
                            }

                            return (
                              <span
                                key={idx}
                                style={{ display: "inline-block" }}
                              >
                                <span
                                  style={{ fontWeight: 500, color: "black" }}
                                >
                                  {displayName}
                                </span>
                                {displayLevel && (
                                  <span
                                    style={{
                                      color: "#ef4444",
                                      fontWeight: 700,
                                      marginLeft: "4px",
                                    }}
                                  >
                                    {displayLevel}
                                  </span>
                                )}
                                {idx < rawSkills.length - 1 && (
                                  <span
                                    style={{
                                      marginRight: "8px",
                                      color: "black",
                                    }}
                                  >
                                    ,
                                  </span>
                                )}
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


      {/* Modal for Add / Edit Modifier */}
      <div className={`modal-overlay ${isModifierModalOpen ? "active" : ""}`}>
        <div className="modal-content">
          <button className="modal-close" onClick={resetModifierForm}>
            <X size={24} />
          </button>
          <h2>
            {modifierFormData.id ? <Edit2 size={24} /> : <Plus size={24} />}{" "}
            {modifierFormData.id ? "Edit Modifier" : "Add New Modifier"}
          </h2>

          <form onSubmit={handleModifierSubmit}>
            <div className="form-group">
              <label>Modifier Name (e.g. Triple 1)</label>
              <input
                type="text"
                name="name"
                value={modifierFormData.name}
                onChange={handleModifierInputChange}
                placeholder="e.g. Double 1"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>Categories (Select all that apply)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {Object.keys(CATEGORIES).map((cat) => {
                    const isActive = modifierFormData.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleModifierCategory(cat)}
                        className={`badge ${isActive ? "active" : ""}`}
                        style={{
                          cursor: "pointer",
                          border: isActive ? "none" : "1px solid var(--border-color)",
                          background: isActive ? "var(--accent-primary)" : "transparent",
                          color: isActive ? "white" : "var(--text-secondary)",
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>Sub Categories (Select all that apply)</label>
                <div style={{ 
                  display: "flex", 
                  flexWrap: "wrap", 
                  gap: "6px",
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  {[...new Set(Object.values(CATEGORIES).flat())]
                    .filter(Boolean)
                    .map((sub) => {
                      const isActive = modifierFormData.subcategories.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleModifierSubcategory(sub)}
                          className={`badge ${isActive ? "active" : ""}`}
                          style={{
                            cursor: "pointer",
                            border: isActive ? "none" : "1px solid var(--border-color)",
                            background: isActive ? "var(--accent-secondary)" : "transparent",
                            color: isActive ? "white" : "var(--text-secondary)",
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          {sub}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Value (e.g. L1, L1, L1)</label>
              <input
                type="text"
                name="value"
                value={modifierFormData.value}
                onChange={handleModifierInputChange}
                placeholder="e.g. L1, L1, L2"
                required
              />
              <p className="text-muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                Format: L1, L1, L2 etc. (This will appear as L1, L1, L2)
              </p>
            </div>

            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label>Social Media / Video Link (Optional)</label>
              <input
                type="text"
                name="socialLink"
                value={modifierFormData.socialLink}
                onChange={handleModifierInputChange}
                placeholder="YouTube or other video link..."
              />
            </div>

            <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 2rem' }}>
                {modifierFormData.id ? "Update Modifier" : "Save Modifier"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Video Pop-out Modal */}
      {videoUrl && (
        <div className="modal-overlay active" onClick={() => setVideoUrl(null)}>
          <div
            className="modal-content video-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "800px", width: "95%", padding: "2rem" }}
          >
            <button className="modal-close" onClick={() => setVideoUrl(null)}>
              <X size={24} />
            </button>

            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <PlaySquare size={24} color="var(--accent-primary)" />
                Skill Demonstration
              </h2>
            </div>

            <div
              className="video-container"
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                height: 0,
                overflow: "hidden",
                borderRadius: "12px",
                background: "#000",
              }}
            >
              {getEmbedUrl(videoUrl) ? (
                <iframe
                  src={getEmbedUrl(videoUrl)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video player"
                ></iframe>
              ) : (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    textAlign: "center",
                    padding: "20px",
                  }}
                >
                  <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
                    This link cannot be embedded directly.
                  </p>
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ textDecoration: "none" }}
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
