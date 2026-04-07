import React from "react";
import { v4 as uuidv4 } from "uuid";
import VariablesManager from "./VariablesManager";
import ImageGallery from "./ImageGallery";
import CagesManager from "./CagesManager";
import { Download, Upload, Save, Plus, Users, Box, Trash2 } from "lucide-react";
import "./CellCulture.css";

export default function Workspace({
  state,
  setState,
  updateState,
  activeSubjectId,
  setActiveSubjectId,
  onExportCSV,
  onExportBackup,
  onImportBackup,
}) {
  const [activeMainTab, setActiveMainTab] = React.useState("subjects");

  const addSubject = () => {
    const newSubject = {
      id: uuidv4(),
      name: `Muestra ${state.subjects.length + 1}`,
      group: "Control",
      measurements: {},
      images: [],
    };
    updateState({ subjects: [...state.subjects, newSubject] });
    setActiveSubjectId(newSubject.id);
  };

  const removeSubject = (id, e) => {
    e.stopPropagation();
    if (
      confirm(
        "¿Seguro que deseas eliminar este sujeto? Sus datos e imágenes serán borrados de este protocolo.",
      )
    ) {
      const newSubjects = state.subjects.filter((s) => s.id !== id);
      updateState({ subjects: newSubjects });
      if (activeSubjectId === id) setActiveSubjectId(null);
    }
  };

  const subjectIndex = state.subjects.findIndex(
    (s) => s.id === activeSubjectId,
  );
  const subject = subjectIndex >= 0 ? state.subjects[subjectIndex] : null;

  const updateSubjectName = (e) => {
    if (!subject) return;
    const newSubjects = [...state.subjects];
    newSubjects[subjectIndex] = { ...subject, name: e.target.value };
    updateState({ subjects: newSubjects });
  };

  const updateMeasurement = (varId, val) => {
    if (!subject) return;
    const newSubjects = [...state.subjects];
    newSubjects[subjectIndex] = {
      ...subject,
      measurements: { ...subject.measurements, [varId]: val },
    };
    updateState({ subjects: newSubjects });
  };

  return (
    <div className="culture-container">
      {/* Header General */}
      <div className="culture-header glass-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h2
              style={{
                color: "var(--text-primary)",
                marginBottom: "4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Users size={24} color="var(--accent)" /> Modelos Murinos y
              Sujetos
            </h2>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button
                className={`btn ${activeMainTab === "subjects" ? "btn-primary" : ""}`}
                onClick={() => setActiveMainTab("subjects")}
              >
                Sujetos Individuales
              </button>
              <button
                className={`btn ${activeMainTab === "cages" ? "btn-primary" : ""}`}
                onClick={() => setActiveMainTab("cages")}
              >
                Jaulas de Crecimiento
              </button>
            </div>
          </div>
          <div
            className="no-print"
            style={{ display: "flex", gap: "8px", paddingBottom: "4px" }}
          >
            <button
              className="btn"
              onClick={onExportCSV}
              title="Exportar tabulados a CSV para Excel"
            >
              <Download size={16} /> CSV
            </button>
            <button className="btn btn-primary" onClick={onExportBackup}>
              <Save size={16} /> Respaldar (JSON)
            </button>
          </div>
        </div>
      </div>

      {activeMainTab === "cages" && (
        <CagesManager state={state} updateState={updateState} />
      )}

      {activeMainTab === "subjects" && (
        <div className="culture-split-view">
          {/* Columna Izquierda: Lista de Sujetos */}
          <div className="culture-sidebar glass-panel no-print">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h4 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Box size={16} /> Sujetos Actuales
              </h4>
              <button
                className="btn-icon"
                onClick={addSubject}
                title="Añadir Sujeto"
                style={{
                  background: "var(--accent)",
                  color: "white",
                  borderRadius: "4px",
                }}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="culture-list">
              {state.subjects.map((s) => (
                <div
                  key={s.id}
                  className={`culture-list-item ${activeSubjectId === s.id ? "active" : ""}`}
                  onClick={() => setActiveSubjectId(s.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginTop: "6px",
                    }}
                  >
                    <span className="culture-list-name">{s.name}</span>
                    <button
                      className="btn-icon"
                      onClick={(e) => removeSubject(s.id, e)}
                      style={{ color: "var(--danger)", padding: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      marginTop: "4px",
                    }}
                  >
                    Grupo: {s.group || "Sin Grupo"}
                  </div>
                </div>
              ))}
              {state.subjects.length === 0 && (
                <div className="empty-mini">
                  No hay sujetos. Añade uno con el botón +.
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Detalles del Sujeto */}
          <div className="culture-timeline-view">
            {!subject ? (
              <div
                className="glass-panel"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "60px 20px",
                  textAlign: "center",
                  height: "100%",
                }}
              >
                <Users
                  size={64}
                  color="var(--accent)"
                  style={{ opacity: 0.3, marginBottom: "20px" }}
                />
                <h3
                  style={{ color: "var(--text-primary)", marginBottom: "8px" }}
                >
                  Selecciona un Sujeto
                </h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Elige un sujeto de la lista o crea uno nuevo para registrar
                  sus variables y evidencia.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={addSubject}
                  style={{ marginTop: "20px", padding: "10px 20px" }}
                >
                  <Plus size={18} /> Crear Nuevo Sujeto
                </button>
              </div>
            ) : (
              <div className="culture-print-section">
                <div
                  className="timeline-header"
                  style={{ marginBottom: "24px" }}
                >
                  <div>
                    <input
                      className="input-field"
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 600,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        marginBottom: "4px",
                        color: "var(--text-primary)",
                      }}
                      value={subject.name}
                      onChange={updateSubjectName}
                      placeholder="Nombre del Sujeto (ej. Ratón 1)"
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginTop: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.9rem",
                          fontWeight: 500,
                        }}
                      >
                        Grupo Exp:
                      </span>
                      <input
                        className="input-field"
                        style={{
                          fontSize: "0.9rem",
                          padding: "4px 8px",
                          maxWidth: "150px",
                        }}
                        value={subject.group || ""}
                        onChange={(e) => {
                          const newSubjects = [...state.subjects];
                          newSubjects[subjectIndex] = {
                            ...subject,
                            group: e.target.value,
                          };
                          updateState({ subjects: newSubjects });
                        }}
                        placeholder="Ej. Control"
                      />
                    </div>
                  </div>
                </div>

                <VariablesManager state={state} setState={setState} />

                <h3 className="section-title">Registro de Datos</h3>
                <div
                  className="glass-panel"
                  style={{ padding: "24px", marginBottom: "40px" }}
                >
                  <div className="data-grid">
                    {state.variables.map((v) => (
                      <div key={v.id} className="input-group">
                        <label className="input-label">
                          {v.name}{" "}
                          {v.unit && (
                            <span style={{ color: "var(--text-secondary)" }}>
                              ({v.unit})
                            </span>
                          )}
                        </label>
                        <input
                          className="input-field"
                          type={v.type === "number" ? "number" : "text"}
                          value={subject.measurements[v.id] ?? ""}
                          onChange={(e) =>
                            updateMeasurement(v.id, e.target.value)
                          }
                          placeholder={`Ingresa ${v.name.toLowerCase()}`}
                        />
                      </div>
                    ))}
                    {state.variables.length === 0 && (
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          gridColumn: "1 / -1",
                        }}
                      >
                        No hay variables definidas. Créalas en el Gestor de
                        Variables arriba.
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="section-title">Carga de Evidencia</h3>
                <ImageGallery
                  subject={subject}
                  onUpdateImages={(images) => {
                    const newSubjects = [...state.subjects];
                    newSubjects[subjectIndex] = { ...subject, images };
                    updateState({ subjects: newSubjects });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
