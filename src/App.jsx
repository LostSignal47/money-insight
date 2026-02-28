import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

import { Line } from "react-chartjs-2";
import { useEffect } from "react";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

function Login({ setIsAuth, theme, setTheme }) {
  const navigate = useNavigate();

  const handleLogin = () => {
    setIsAuth(true);
    navigate("/MoneyInsight");
  };

  return (
    <div className="h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-300">Login</h1>
      <button
        onClick={handleLogin}
        className="bg-blue-500 text-white px-6 py-2 rounded"
      >
        Login (Local Test)
      </button>

      <button
        onClick={() =>
            setTheme(theme === "light" ? "dark" : "light")
          }
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 dark:text-white"
      >
          {theme === "light" ? "🌙 โหมดมืด" : "☀ โหมดสว่าง"}
      </button>
    </div>
  );
}

function Dashboard({ setIsAuth, theme, setTheme }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(selectedMonth.split("-")[0]);
  const [date, setDate] = useState(today);
  const [openDates, setOpenDates] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [chartMode, setChartMode] = useState("monthly");
  const [monthlyBudgets, setMonthlyBudgets] = useState({});
  const [budgetInput, setBudgetInput] = useState("");
  const [categories, setCategories] = useState([
    "อาหาร",
    "เดินทาง",
    "ช้อปปิ้ง",
    "อื่นๆ",
  ]);

  const handleAddExpense = async() => {
    if (isSubmitting) return; // 🔥 กันกดรัว

    if (!amount || !category || !date || (category === "อื่นๆ" && !customCategory.trim()))
    return;

    if (Number(amount) <= 0) return;

    setIsSubmitting(true); // 🔒 ล็อกปุ่ม

    try {
      const newMonth = date.slice(0, 7);
      const newYear = date.slice(0, 4);

      let finalCategory = category;

      if (category === "อื่นๆ") {
        const cleanedInput = customCategory.trim();

        // 🔥 เช็คว่าหมวดนี้มีอยู่แล้วไหม (case insensitive)
        const existingCategory = categories.find(
          (cat) =>
            cat.toLowerCase() === cleanedInput.toLowerCase()
        );

        finalCategory = existingCategory || cleanedInput;

        // 🔥 ถ้าไม่มีใน list ให้เพิ่มเข้า categories
        if (!existingCategory) {
          setCategories((prev) => [...prev, cleanedInput]);
        }
      }

      const { error } = await supabase.from("expenses").insert([
        {
          amount: Number(amount),
          category: finalCategory,
          date,
        },
      ]);

      if (error) {
        console.error("Insert error:", error);
        return;
      }

      await fetchExpenses();


      // 🔥 เปลี่ยนไปเดือนที่เพิ่ม
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);

      setAmount("");
      setCategory("");
      setCustomCategory("");
    } finally {
      setIsSubmitting(false); // 🔓 ปลดล็อกปุ่ม
    }
  };

  const handleDelete = async (id) => {
    const{ error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      return;
    }

    await fetchExpenses();
  };

  const handleLogout = () => {
    setIsAuth(false);
    navigate("/");
  };

  const filteredExpenses = expenses.filter(
    (item) => item.date.slice(0, 7) === selectedMonth
  );

  const total = filteredExpenses.reduce((s, i) => s + i.amount, 0);

  const monthlyTotals = expenses.reduce((acc, item) => {
    const key = item.date.slice(0, 7);
    acc[key] = (acc[key] || 0) + item.amount;
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthlyTotals).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  const years = [
    ...new Set(sortedMonths.map((month) => month.split("-")[0])),
  ];

  const monthsOfSelectedYear = sortedMonths.filter(
    (month) => month.startsWith(selectedYear)
  );

  useEffect(() => {
    if (sortedMonths.length === 0) return;

    const latestMonth = sortedMonths[sortedMonths.length - 1];
    const latestYear = latestMonth.split("-")[0];

    if (!sortedMonths.includes(selectedMonth)) {
      setSelectedMonth(latestMonth);
    }

    if (!years.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [expenses]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });

    
    if (error) {
        console.error("Fetch error:", error);
        return;
      }

      setExpenses(data ?? []);
  };

  /* ================== Budget Logic ================== */

  const currentBudget = monthlyBudgets[selectedMonth] || 0;
  const usagePercent =
    currentBudget > 0 ? (total / currentBudget) * 100 : 0;

  let budgetStatus = "safe";
  if (usagePercent >= 100) budgetStatus = "over";
  else if (usagePercent >= 85) budgetStatus = "danger";
  else if (usagePercent >= 60) budgetStatus = "warning";

  const handleSetBudget = () => {
    if (!budgetInput || Number(budgetInput) <= 0) return;

    setMonthlyBudgets((prev) => ({
      ...prev,
      [selectedMonth]: Number(budgetInput),
    }));

    setBudgetInput("");
  };

  const remainingBudget = currentBudget - total;
     
  /* ================== Prediction ================== */

  const lastThreeMonths = sortedMonths.slice(-3);
  let predictedNextMonth = null;
  let volatilityLevel = null;

  if (lastThreeMonths.length >= 3) {
    const values = lastThreeMonths.map((m) => monthlyTotals[m]);
    const avg =
      values.reduce((a, b) => a + b, 0) / values.length;

    predictedNextMonth = Math.round(avg);

    const max = Math.max(...values);
    const min = Math.min(...values);
    const ratio = (max - min) / avg;

    if (ratio < 0.15) volatilityLevel = "ต่ำ";
    else if (ratio < 0.3) volatilityLevel = "ปานกลาง";
    else volatilityLevel = "สูง";
  }

  /* ================== Extra Insight ================== */

  // หมวดที่ใช้เยอะที่สุด
  const categoryTotals = filteredExpenses.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const highestCategory =
    Object.keys(categoryTotals).length > 0
      ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  // วันที่ใช้เยอะที่สุด
  const dayTotals = filteredExpenses.reduce((acc, item) => {
    acc[item.date] = (acc[item.date] || 0) + item.amount;
    return acc;
  }, {});

  const highestDay =
    Object.keys(dayTotals).length > 0
      ? Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0][0]
      : null;
  const formattedHighestDay = highestDay
  ? new Date(highestDay).toLocaleDateString(
      "th-TH-u-ca-gregory",
      {
        day: "numeric", 
        month: "short", 
        year: "numeric"
      }
    )
  : null;

  // เปรียบเทียบเดือนล่าสุดกับเดือนก่อน
  let monthlyChangePercent = null;

  if (sortedMonths.length >= 2) {
    const latest = sortedMonths[sortedMonths.length - 1];
    const previous = sortedMonths[sortedMonths.length - 2];

    const latestValue = monthlyTotals[latest];
    const previousValue = monthlyTotals[previous];

    if (previousValue !== 0) {
      monthlyChangePercent =
        ((latestValue - previousValue) / previousValue) * 100;
    }
  }

  /* ================== Chart ================== */

  const last12Months = sortedMonths.slice(-12);

  const isDark = theme === "dark";
  const lineChartData = {
    labels: last12Months.map((month) => {
      const dateObj = new Date(month + "-01");
      return dateObj.toLocaleString("th-TH-u-ca-gregory", {
        month: "short",
        year: "2-digit",
      });
    }),
    datasets: [
      {
        label: "ยอดรวมรายเดือน",
        data: last12Months.map((m) => monthlyTotals[m]),
        borderColor: isDark ? "#22D3EE" : "#3B82F6",
        backgroundColor: isDark ? "rgba(56,189,248,0.2)" : "rgba(59,130,246,0.2)",
        pointBackgroundColor: isDark ? "#22D3EE" : "#3B82F6",
        tension: 0.3,

        pointRadius: 4,
      },
    ],
  };

  // 🔥 เพิ่ม weekly chart
  const weeklyTotals = filteredExpenses.reduce((acc, item) => {
    const day = new Date(item.date).getDate();
    const week = Math.ceil(day / 7);
    const key = `สัปดาห์ ${week}`;
    acc[key] = (acc[key] || 0) + item.amount;
    return acc;
  }, {});

  const weeklyChartData = {
    labels: Object.keys(weeklyTotals),
    datasets: [
      {
        label: "ยอดรวมรายสัปดาห์",
        data: Object.values(weeklyTotals),
        borderColor: "#10B981",
        backgroundColor: "rgba(16,185,129,0.2)",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        bottom: 30,
      },
    },
    plugins: {
      legend: {
        labels: {
          color: isDark ? "#E2E8F0" : "#1E293B",
        },
      },
    },
    scales: {
      x: {
        ticks: {
          padding: 10,
          color: isDark ? "#CBD5E1" : "#334155",
        },
        grid: {
          color: isDark
            ? "rgba(250, 250, 250, 0.5)"
            : "rgba(0,0,0,0.05)",
        },
      },
      y: {
        ticks: {
          color: isDark ? "#CBD5E1" : "#334155",
        },
        grid: {
          color: isDark
            ? "rgb(255, 255, 255, 0.5)"
            : "rgba(0,0,0,0.05)",
        },
      },
    },
  };

  const groupedExpenses = filteredExpenses.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const toggleDate = (date) => {
    setOpenDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  /* ================== UI ================== */

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 px-4 py-10 md:px-10 overflow-x-hidden">
      <div className="max-w-7xl w-full mx-auto">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">

          {/* ชื่อระบบ */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">
              ระบบวิเคราะห์การใช้จ่าย
            </h1>
            <p className="text-md text-slate-500 dark:text-slate-300">
              ภาพรวมและแนวโน้มการใช้จ่ายรายเดือน
            </p>
          </div>

          {/* ตัวควบคุม */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl shadow border border-gray-100 dark:border-slate-700">

            {/* ปี */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                const firstMonthOfYear = sortedMonths.find((m) =>
                  m.startsWith(e.target.value)
                );
                if (firstMonthOfYear) {
                  setSelectedMonth(firstMonthOfYear);
                }
              }}
              className="min-w-[110px] border rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:text-white"
            >
              {[...years]
                .sort((a, b) => b - a)
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>

            {/* เดือน */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-w-[110px] border rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:text-white"
            >
              {monthsOfSelectedYear.map((month) => {
                const dateObj = new Date(month + "-01");
                const label = dateObj.toLocaleString("th-TH", {
                  month: "long",
                });
                return (
                  <option key={month} value={month}>
                    {label}
                  </option>
                );
              })}
            </select>

            {/* ปุ่ม theme */}
            <button
              onClick={() =>
                setTheme(theme === "light" ? "dark" : "light")
              }
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 transition"
            >
              {theme === "light" ? "🌙" : "☀"}
            </button>

          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* LEFT */}
          <div className="md:col-span-2 space-y-6">

            {/* FORM */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 space-y-4">
              <h2 className="font-semibold text-lg text-slate-800 dark:text-white">
                เพิ่มรายการ
              </h2>

              <input
                type="number"
                placeholder="จำนวนเงิน(บาท)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border rounded-xl px-4 py-2"
              />

              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value !== "อื่นๆ") {
                    setCustomCategory("");
                  }
                }}
                className="w-full border rounded-xl px-4 py-2"
              >
                <option value="">เลือกหมวดหมู่</option>
                <option value="อาหาร">อาหาร</option>
                <option value="เดินทาง">เดินทาง</option>
                <option value="ช้อปปิ้ง">ช้อปปิ้ง</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>

              {category === "อื่นๆ" && (
                <input
                  type="text"
                  placeholder="กรอกหมวดหมู่"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2 mt-2"
                />
              )}

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded-xl px-4 py-2"
              />

              <button
                onClick={handleAddExpense}
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl font-medium transition ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-[1.02]"
                } text-white`}
              >
                {isSubmitting ? "กำลังเพิ่ม..." : "เพิ่มรายการ"}
              </button>
            </div>

            {/* LIST */}
            {expenses.length === 0 && (
              <div className="text-center py-20 text-slate-400 dark:text-slate-500">
                ยังไม่มีข้อมูลการใช้จ่าย
                <br />
                เริ่มเพิ่มรายการแรกของคุณได้เลย
              </div>
            )}

            {Object.entries(groupedExpenses)
            .sort((a, b) => new Date(b[0]) - new Date(a[0])) // เรียงวันที่ใหม่ก่อน
            .map(([date, items]) => {
                const dayTotal = items.reduce(
                  (s, i) => s + i.amount,
                  0
                );

                return (
                  <div
                    key={date}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow border border-gray-100 dark:border-slate-700 overflow-hidden"
                  >
                    <div
                      onClick={() => toggleDate(date)}
                      className="p-4 bg-slate-200 dark:bg-slate-700 font-semibold text-slate-800 dark:text-white flex justify-between cursor-pointer"
                    >
                      <span>
                        📅 {
                          new Date(date).toLocaleDateString(
                            "th-TH-u-ca-gregory",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        } (รวม {dayTotal} บาท)
                      </span>
                      <span>
                        {openDates[date] ? "▲" : "▼"}
                      </span>
                    </div>

                    {openDates[date] &&
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between p-4 border-t dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          <span>
                            {item.category} -{" "}
                            {item.amount} บาท
                          </span>
                          <button
                            onClick={() => setDeleteId(item.id)}
                            className="text-rose-500 hover:text-rose-600"
                          >
                            ลบ
                          </button>
                        </div>
                      ))}
                  </div>
                );
              }
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-6">

            {/* SUMMARY */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 space-y-5">
              <div>
                <p className="text-gray-500 text-lg dark:text-slate-400">
                  ยอดใช้จ่ายเดือนนี้
                </p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {total.toLocaleString()} บาท
                </p>
                {currentBudget > 0 && (
                  <div className="text-slate-600 dark:text-slate-300 mt-2 space-y-1">
                    <p>งบทั้งหมด: {currentBudget.toLocaleString()} บาท</p>

                    {remainingBudget >= 0 ? (
                      <p className="text-emerald-500">
                        เหลืองบ: {remainingBudget.toLocaleString()} บาท
                      </p>
                    ) : (
                      <p className="text-rose-500 font-semibold">
                        ⚠ เกินงบ: {Math.abs(remainingBudget).toLocaleString()} บาท
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="number"
                  placeholder="ตั้งงบเดือนนี้"
                  value={budgetInput}
                  onChange={(e) =>
                    setBudgetInput(e.target.value)
                  }
                  className="flex-1 border rounded-xl px-4 py-2"
                />
                <button
                  onClick={handleSetBudget}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-xl"
                >
                  บันทึก
                </button>
              </div>

              {currentBudget > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
                    ใช้ไป {usagePercent.toFixed(1)}%
                  </p>
                  <div className="w-full bg-gray-200 rounded h-3">
                    <div
                      className={`h-3 rounded ${
                        budgetStatus === "over"
                          ? "bg-red-500"
                          : budgetStatus === "danger"
                          ? "bg-red-400"
                          : budgetStatus === "warning"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          usagePercent,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CHART */}
            {sortedMonths.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 h-[410px]">

                {/* 🔥 Toggle Buttons */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setChartMode("monthly")}
                    className={`px-4 py-2 rounded-xl ${
                      chartMode === "monthly"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    รายเดือน
                  </button>

                  <button
                    onClick={() => setChartMode("weekly")}
                    className={`px-4 py-2 rounded-xl ${
                      chartMode === "weekly"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    รายสัปดาห์
                  </button>
                </div>

                <Line
                  data={
                    chartMode === "monthly"
                      ? lineChartData
                      : weeklyChartData
                  }
                  options={chartOptions}
                />
              </div>
            )}

            {/* INSIGHT */}
            {filteredExpenses.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 space-y-5">

                <h2 className="text-lg font-semibold text-slate-800 dark:text-white border-b pb-2">
                  📊 สรุปและวิเคราะห์การใช้จ่าย
                </h2>

                {/* กลุ่มที่ 1 */}
                <div className="space-y-2">
                  <p className="text-lg font-bold text-slate-500 dark:text-white">
                    พฤติกรรมการใช้เงิน
                  </p>

                  {highestCategory && (
                    <p className="text-lg text-slate-700 dark:text-slate-300">
                      📌 หมวดที่ใช้มากที่สุด: 
                      <span className="font-semibold"> {highestCategory}</span>
                    </p>
                  )}

                  {formattedHighestDay && (
                    <p className="text-lg text-slate-700 dark:text-slate-300">
                      📅 วันที่ใช้มากที่สุด: 
                      <span className="font-semibold"> {formattedHighestDay}</span>
                    </p>
                  )}
                </div>

                {/* กลุ่มที่ 2 */}
                <div className="space-y-2">
                  <p className="text-lg font-bold text-slate-500 dark:text-white">
                    แนวโน้มและการเปรียบเทียบ
                  </p>

                  {monthlyChangePercent !== null && (
                    <p className={`text-lg ${
                      monthlyChangePercent > 0
                        ? "text-rose-500"
                        : "text-emerald-500"
                    }`}>
                      {monthlyChangePercent > 0 ? "📈 เพิ่มขึ้น" : "📉 ลดลง"}{" "}
                      {Math.abs(monthlyChangePercent).toFixed(1)}%
                      เมื่อเทียบกับเดือนก่อน
                    </p>
                  )}

                  {predictedNextMonth && (
                    <p className="text-lg text-slate-700 dark:text-slate-300">
                      🔮 คาดการณ์เดือนหน้า:{" "}
                      <span className="font-semibold">
                        {predictedNextMonth.toLocaleString()} บาท
                      </span>
                    </p>
                  )}

                  {volatilityLevel && (
                    <p className="text-lg text-slate-700 dark:text-slate-300">
                      📊 ระดับความผันผวน:{" "}
                      <span className="font-semibold">
                        {volatilityLevel}
                      </span>
                    </p>
                  )}
                </div>

              </div>
            )}

            {deleteId && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl w-80 animate-scale-in">

                  <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">
                    ยืนยันการลบ
                  </h3>

                  <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
                    คุณต้องการลบรายการนี้หรือไม่?
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-slate-300"
                    >
                      ยกเลิก
                    </button>

                    <button
                      onClick={() => {
                        handleDelete(deleteId);
                        setDeleteId(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500 text-white"
                    >
                      ลบ
                    </button>
                  </div>

                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full bg-red-500 text-white py-3 rounded-xl"
            >
              Logout
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isAuth, setIsAuth] = useState(false);

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) return savedTheme;

    return window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;

    localStorage.setItem("theme", theme);

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Login
            setIsAuth={setIsAuth}
            theme={theme}
            setTheme={setTheme}
          />
        }
      />
      <Route
        path="/MoneyInsight"
        element={
          <Dashboard
            setIsAuth={setIsAuth}
            theme={theme}
            setTheme={setTheme}
          />
        }
      />
    </Routes>
  );
}

export default App;