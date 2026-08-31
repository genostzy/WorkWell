# WorkWell

A workplace wellbeing + HR platform, built around a strict split between
what's private to an employee and what's visible to their employer. The
app itself lives in [`workwell-app/`](workwell-app) (Next.js + Supabase).

This file is the user manual — a plain-language guide to using the app.
No technical knowledge needed.

---

## What is WorkWell?

WorkWell is a workplace app with two separate sides:

- **Your side** (private) — your daily mood check-ins, your own personal
  task list, your boundaries/quiet-hours settings. **Your employer cannot
  see any of this**, ever, for any individual person.
- **Work side** — things that are naturally part of your job: your
  attendance, leave requests, expenses, payslips, tasks your manager gave
  you, company policies and news.

The app draws this as a "room" — a little office you walk around, where
each piece of furniture opens a different feature. If that doesn't make
sense yet, it will once you're in it.

---

## Test accounts

Two accounts are already set up so you can try the app without waiting
for anyone to create one for you:

| Role | Email | Password |
|---|---|---|
| Employee | `test.employee@workwell.com` | `Testpass123!` |
| HR / Admin | `bigbossoma@workwell.com` | `12345678` |

Sign in as the **Employee** account first — it shows the everyday
experience most people will actually use. Sign in as **HR** afterward to
see the management side.

> Normal accounts are **not** self-service — there's no "create an
> account" button. In a real workplace, HR sets up your account for you
> and gives you the password.

---

## 1. Signing in

1. Go to the site (`workwell.app`).
2. You'll see a **"Welcome back"** card on the left, with a picture of a
   little office on the right.
3. Type the email into **Work email**, and the password into
   **Password**.
4. Click **Sign in**.

If you type the wrong email or password, the form will tell you they
don't match — nothing bad happens, just try again.

---

## 2. If you signed in as an Employee

You'll land in **your room**. Every labeled item in the room is a
button — click any of them to open that feature. Here's what each one
does:

### Your side (private — your employer never sees this)

| In the room | What it does |
|---|---|
| **Journal** | Your daily check-in. Four quick taps — mood, energy, pressure, workload — about 10 seconds. Every question is optional. Answer honestly; this never reaches your employer, not even in a summarized form. |
| **Water cooler** | Gentle reminders (move around, drink water, take a breath) — these are entirely optional and you can turn them off. |
| **The clock** | Your "boundaries" — set quiet hours so messages sent to you outside work hours wait until you're back, instead of pinging you at night. |
| **The sofa** | Send a colleague a thank-you (peer appreciation), or privately ask HR/an EAP counselor for support — you can withdraw a support request at any time. |
| **Your shelf** | Display settings — light/dark mode, larger text, reduced motion, and similar accessibility options. |
| **Your desk** | Your own personal trends over time — a private view of your own check-in history. |

### Work side (your employer can see this — it's normal employment
information, like a timesheet or a leave form)

| In the room | What it does |
|---|---|
| **Front door** | Sign in and out for the day — this is your time clock. Click it once to time in when your shift starts, once to time out when it ends. |
| **Task board** | Two lists: tasks your manager gave you, and your own personal to-do list (which stays private, even though it lives on this screen). You can comment on a task your manager gave you if something's blocking it. |
| **Attendance** | A calendar of your time-in/time-out history for the week. |
| **Your locker** | Request time off, and see/edit your basic profile information. |
| **Policies** | Company policies to read. |
| **Expenses** | Submit a reimbursement claim, attach a receipt, and track whether it's been approved. |
| **Assets** | Company equipment issued to you (laptop, badge, etc.) |
| **Payroll** | Your payslips. |
| **News** | Company announcements. |
| **Complaints** | File a workplace complaint/case with HR. |
| **Resignations** | Give formal notice if you're leaving. |

A bell icon in the top-right corner shows notifications — for example,
when someone assigns you a new task.

---

## 3. If you signed in as HR

HR does not get a personal room — instead you land straight on a
management dashboard. The left-hand menu lists:

| Screen | What it does |
|---|---|
| **Structural load** | An anonymous, organization-wide dashboard — average mood/energy/pressure/workload **by department**, never by individual person. Any group smaller than 8 people is hidden completely, so no one can be singled out. |
| **People** | The employee directory — job titles, departments, managers. |
| **Accounts & access** | Create new employee accounts and reset passwords. |
| **Decisions** | A history log of decisions HR has made (approvals, declines, etc.) |
| **Working hours** | Set up shift schedules and assign them to people. |
| **Task board** | Assign a task to someone, and see the status of every task assigned across the company. |
| **Holidays** | The company holiday calendar. |
| **Payroll** | Issue payslips. |
| **Assets** | Track equipment issued to and returned by employees. |
| **Letter heads / Data fields** | Templates and custom fields used elsewhere in the app. |
| **Offboarding / Warnings** | Employee exit checklists and formal warnings. |

Everywhere HR looks, it's clearly labeled which "plane" the data is on —
a badge on the page tells you whether what you're looking at is
individually-identifiable employment data, or an anonymous group pattern.
HR never has a way to open an individual employee's private Journal,
mood history, or boundaries — those screens simply don't exist for an HR
account, by design.

---

## 4. Signing out

Click **Front door** (employee) from anywhere in the room, or **Sign
out** in the top-right corner (HR), at any time.

---

## Frequently asked questions

**Can my employer see my mood check-ins?**
No. Nothing on the private side of the app — check-ins, your own task
list, boundaries — is visible to HR or any manager, for any single
person, under any circumstance.

**What does HR actually see, then?**
Only ordinary employment records (attendance, leave, expenses, tasks
they assigned you, payroll) and anonymous group-level averages for
teams of 8 people or more. They can never see how any one specific
person answered a check-in.

**I forgot my password.**
Ask HR — they can reset it for you from **Accounts & access**. There is
no self-service "forgot password" flow in this version.

**Can I skip a check-in question?**
Yes. Every question in the Journal is optional, and skipping one has no
consequence — no reminder, no flag, nothing recorded about the skip.
