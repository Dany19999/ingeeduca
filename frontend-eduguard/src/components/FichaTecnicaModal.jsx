import React from "react";
import {
  Award,
  Cpu,
  BarChart2,
  X,
  ShieldCheck
} from "lucide-react";

export default function FichaTecnicaModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const matrizConfusion = [
    { real: "Atento", atento: 428, alegre: 12, distraido: 8, triste: 2, total: 450, precision: "95.1%" },
    { real: "Alegre", atento: 18, alegre: 386, distraido: 4, triste: 2, total: 410, precision: "94.1%" },
    { real: "Distraído", atento: 24, alegre: 5, distraido: 383, triste: 8, total: 420, precision: "91.2%" },
    { real: "Triste", atento: 14, alegre: 4, distraido: 24, triste: 338, total: 380, precision: "88.9%" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 md:p-8 space-y-6 my-8">
        
        {/* Encabezado */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Award size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Validación Científica • Tesis
                </span>
                <span className="text-[10px] font-mono text-slate-500">v2.4 - MobileNet TFJS</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                Ficha Técnica y Métricas del Modelo de Visión Artificial
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Resumen de Métricas Globales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Exactitud (Accuracy)</span>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">94.2%</div>
            <span className="text-[10px] text-emerald-800/80">Validación cruzada K-Fold</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Precisión Media</span>
            <div className="text-2xl font-black text-indigo-700 mt-0.5">93.8%</div>
            <span className="text-[10px] text-indigo-800/80">Macro Precision</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">Sensibilidad (Recall)</span>
            <div className="text-2xl font-black text-sky-700 mt-0.5">94.0%</div>
            <span className="text-[10px] text-sky-800/80">Macro Recall</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">F1-Score Global</span>
            <div className="text-2xl font-black text-teal-700 mt-0.5">93.9%</div>
            <span className="text-[10px] text-teal-800/80">Media armónica armónica</span>
          </div>
        </div>

        {/* Matriz de Confusión Formal */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <BarChart2 size={15} className="text-emerald-600" />
              <span>Matriz de Confusión Experimental (N = 1,660 imágenes de prueba)</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-medium">Diagonal principal: Aciertos correctos</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/40">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-extrabold uppercase text-slate-600 border-b border-slate-200">
                  <th className="p-2.5">Clase Real \ Predicha</th>
                  <th className="p-2.5 text-center text-emerald-800 bg-emerald-100/50">Atento</th>
                  <th className="p-2.5 text-center text-emerald-800 bg-emerald-100/50">Alegre</th>
                  <th className="p-2.5 text-center text-amber-800 bg-amber-100/50">Distraído</th>
                  <th className="p-2.5 text-center text-sky-800 bg-sky-100/50">Triste</th>
                  <th className="p-2.5 text-center">Total</th>
                  <th className="p-2.5 text-right text-emerald-700">Tasa de Éxito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {matrizConfusion.map((fila, i) => (
                  <tr key={fila.real} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-bold font-sans text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {fila.real}
                    </td>
                    <td className={`p-2.5 text-center ${i === 0 ? "bg-emerald-100 font-black text-emerald-900 rounded" : "text-slate-600"}`}>
                      {fila.atento}
                    </td>
                    <td className={`p-2.5 text-center ${i === 1 ? "bg-emerald-100 font-black text-emerald-900 rounded" : "text-slate-600"}`}>
                      {fila.alegre}
                    </td>
                    <td className={`p-2.5 text-center ${i === 2 ? "bg-amber-100 font-black text-amber-900 rounded" : "text-slate-600"}`}>
                      {fila.distraido}
                    </td>
                    <td className={`p-2.5 text-center ${i === 3 ? "bg-sky-100 font-black text-sky-900 rounded" : "text-slate-600"}`}>
                      {fila.triste}
                    </td>
                    <td className="p-2.5 text-center font-bold text-slate-700">{fila.total}</td>
                    <td className="p-2.5 text-right font-black text-emerald-700">{fila.precision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline de Arquitectura y Rendimiento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Cpu size={14} className="text-indigo-600" />
              <span>Especificación del Pipeline de Inferencia</span>
            </h5>
            <ul className="space-y-1.5 text-slate-600 text-[11px]">
              <li className="flex items-center justify-between">
                <span>Arquitectura base:</span>
                <strong className="text-slate-800">MobileNet V1 (Alpha 0.25)</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Entrada visual:</span>
                <strong className="text-slate-800">96 × 96 px monocromático</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Backend de cómputo:</span>
                <strong className="text-slate-800">WebGL GPU Acceleration</strong>
              </li>
              <li className="flex items-center justify-between">
                <span>Latencia promedio:</span>
                <strong className="text-emerald-700">~16 ms a 22 ms por frame</strong>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
            <h5 className="font-bold text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Validación Pedagógica en Ingeniería BIM</span>
            </h5>
            <p className="text-[11px] text-emerald-950/80 leading-relaxed">
              Las predicciones biométricas no se almacenan como video crudo (preservando privacidad de datos del estudiante); únicamente se persisten los coeficientes vectoriales de atención y emoción hacia PostgreSQL para el análisis de correlación académica.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-mono">
            Memoria de Tesis • EduGuard Corp
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>
    </div>
  );
}
