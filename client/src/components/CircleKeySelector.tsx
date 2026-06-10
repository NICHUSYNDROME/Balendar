import { useState } from 'react';

// 半音阶排列（顺时针，C 在 12 点）
const CIRCLE_KEYS: Array<{ major: string; minor: string }> = [
  { major: 'C', minor: 'Am' },
  { major: 'C#', minor: 'A#m' },
  { major: 'D', minor: 'Bm' },
  { major: 'Eb', minor: 'Cm' },
  { major: 'E', minor: 'C#m' },
  { major: 'F', minor: 'Dm' },
  { major: 'F#', minor: 'D#m' },
  { major: 'G', minor: 'Em' },
  { major: 'Ab', minor: 'Fm' },
  { major: 'A', minor: 'F#m' },
  { major: 'Bb', minor: 'Gm' },
  { major: 'B', minor: 'G#m' },
];

// DB 存储用音名（统一升号）
const TO_DB_KEY: Record<string, string> = {
  'C': 'C', 'C#': 'C#', 'D': 'D', 'Eb': 'D#', 'E': 'E', 'F': 'F',
  'F#': 'F#', 'G': 'G', 'Ab': 'G#', 'A': 'A', 'Bb': 'A#', 'B': 'B',
};

// DB 音名 → 显示名（统一降号）
const DB_TO_DISPLAY: Record<string, string> = {
  'C': 'C', 'G': 'G', 'D': 'D', 'A': 'A', 'E': 'E', 'B': 'B',
  'F#': 'F#', 'C#': 'C#',
  'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb', 'F': 'F',
};

// SVG 尺寸
const S = 380;        // viewBox 尺寸
const CX = S / 2;     // 圆心 X
const CY = S / 2;     // 圆心 Y
const OR = 155;       // 外半径
const IR = 55;        // 内半径（中心空洞）
const MR = (OR + IR) / 2; // 中间半径（用于文字）
const ITEMS = CIRCLE_KEYS.length;

/** 生成一个扇片的 SVG 路径 */
function slicePath(index: number): string {
  const startDeg = (index / ITEMS) * 360 - 90;
  const endDeg = ((index + 1) / ITEMS) * 360 - 90;
  const sr = (startDeg * Math.PI) / 180;
  const er = (endDeg * Math.PI) / 180;

  const ix = CX + IR * Math.cos(sr);
  const iy = CY + IR * Math.sin(sr);
  const ox = CX + OR * Math.cos(sr);
  const oy = CY + OR * Math.sin(sr);
  const ox2 = CX + OR * Math.cos(er);
  const oy2 = CY + OR * Math.sin(er);
  const ix2 = CX + IR * Math.cos(er);
  const iy2 = CY + IR * Math.sin(er);

  return [
    `M ${ix} ${iy}`,
    `L ${ox} ${oy}`,
    `A ${OR} ${OR} 0 0 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${IR} ${IR} 0 0 0 ${ix} ${iy}`,
    'Z',
  ].join(' ');
}

/** 获取某个扇片的文字坐标（中间角度、指定半径） */
function labelPos(index: number, radius: number) {
  const midDeg = ((index + 0.5) / ITEMS) * 360 - 90;
  const rad = (midDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

interface CircleKeySelectorProps {
  value: string[];   // DB 中存储的音名数组，如 ['A', 'C']
  onChange: (keys: string[]) => void;
}

export default function CircleKeySelector({ value, onChange }: CircleKeySelectorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const openAdd = () => {
    setEditIndex(null);
    setShowPicker(true);
  };

  const openEdit = (idx: number) => {
    setEditIndex(idx);
    setShowPicker(true);
  };

  const selectKey = (dbKey: string) => {
    if (editIndex !== null) {
      // 替换该位置的调性
      const next = [...value];
      next[editIndex] = dbKey;
      onChange(next);
    } else {
      // 追加
      onChange([...value, dbKey]);
    }
    setShowPicker(false);
    setEditIndex(null);
  };

  const removeKey = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* 已选择的调性列表 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {value.map((key, i) => (
          <span
            key={`${key}-${i}`}
            onClick={() => openEdit(i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1d4ed8',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
            title="点击修改此调"
          >
            {DB_TO_DISPLAY[key] || key}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeKey(i); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#93c5fd',
                fontSize: '16px',
                lineHeight: 1,
                padding: 0,
              }}
              title="移除此调"
            >
              ×
            </button>
          </span>
        ))}

        {/* 添加按钮 */}
        <button
          type="button"
          onClick={openAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px dashed #3b82f6',
            background: '#f0f7ff',
            color: '#3b82f6',
            fontSize: '20px',
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1,
          }}
          title="添加调性"
        >
          +
        </button>
      </div>

      {/* 五度圈弹出层 */}
      {showPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => { setShowPicker(false); setEditIndex(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              shapeRendering: 'crispEdges',
              borderRadius: '50%',
              padding: '12px',
              boxShadow: '0 4px 30px rgba(0,0,0,0.2)',
              pointerEvents: 'auto',
            }}
          >
            <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block' }}>
              {/* 12 个扇片 */}
              {CIRCLE_KEYS.map((item, i) => {
                const dbKey = TO_DB_KEY[item.major];
                const isSelected = value.includes(dbKey);
                const isEditing = editIndex !== null && value[editIndex] === dbKey;

                let fill = '#fff';
                let stroke = '#d1d5db';
                if (isEditing) { fill = '#dbeafe'; stroke = '#3b82f6'; }
                else if (isSelected) { fill = '#f0f7ff'; stroke = '#93c5fd'; }

                return (
                  <g key={item.major} style={{ cursor: isSelected && !isEditing ? 'default' : 'pointer' }}>
                    <path
                      d={slicePath(i)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isEditing ? 2.5 : 1}
                      onClick={() => {
                        if (!isSelected || isEditing) selectKey(dbKey);
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected || isEditing) {
                          (e.currentTarget as SVGPathElement).setAttribute('fill', '#dbeafe');
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as SVGPathElement).setAttribute('fill', fill);
                      }}
                    />
                    {/* 大调文字（外圈） */}
                    <text
                      x={labelPos(i, MR + 28).x}
                      y={labelPos(i, MR + 28).y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="17"
                      fontWeight="700"
                      fill={isSelected ? '#1d4ed8' : '#1e293b'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {item.major}
                    </text>
                    {/* 小调文字（内圈） */}
                    <text
                      x={labelPos(i, MR - 24).x}
                      y={labelPos(i, MR - 24).y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fill={isSelected ? '#93c5fd' : '#94a3b8'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {item.minor}
                    </text>
                  </g>
                );
              })}

              {/* 中心装饰圆 */}
              <circle cx={CX} cy={CY} r={IR - 4} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
