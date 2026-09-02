import { useEffect, useMemo, useState } from 'react';
import { createTask, getTasks, removeTask, reorderTasks, updateTask } from './api';
import { getCurrentUser, login, logout, register, requestPasswordReset, resetPassword } from './auth';

const THEME_KEY = 'taskflow-theme';

const makeId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDate = (dateString) => {
    if (!dateString) return 'No date';

    const date = new Date(dateString + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return 'No date';

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
};

const formatTime = (timeValue) => {
    if (!timeValue) return 'No reminder';
    const [hours, minutes] = timeValue.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
};

const getPriorityValue = (priority) => {
    const values = { Low: 1, Medium: 2, High: 3 };
    return values[priority] ?? 2;
};

function App() {
    const [tasks, setTasks] = useState([]);
    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState('login');
    const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [resetToken, setResetToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        dueDate: '',
        reminderTime: '',
        priority: 'Medium',
    });
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [editingId, setEditingId] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
    const [reminderMessage, setReminderMessage] = useState('');
    const [editForm, setEditForm] = useState({
        title: '',
        dueDate: '',
        reminderTime: '',
        priority: 'Medium',
    });

    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        document.body.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    useEffect(() => {
        getCurrentUser()
            .then((currentUser) => {
                setUser(currentUser);
                return currentUser ? getTasks().then(setTasks) : null;
            })
            .catch((error) => setApiError(error.message))
            .finally(() => {
                setAuthLoading(false);
                setLoading(false);
            });
    }, []);

    const handleAuth = async (event) => {
        event.preventDefault();
        await runApiAction(async () => {
            if (authMode === 'forgot') {
                const result = await requestPasswordReset({ email: authForm.email });
                setResetToken(result.developmentToken || '');
                setApiError(result.message);
                return;
            }

            if (authMode === 'reset') {
                await resetPassword({ email: authForm.email, token: resetToken, newPassword: authForm.password });
                setAuthMode('login');
                setApiError('Password reset successfully. You can now log in.');
                return;
            }

            const authenticatedUser = authMode === 'login'
                ? await login(authForm)
                : await register(authForm);
            setUser(authenticatedUser);
            setTasks(await getTasks());
            setAuthForm({ name: '', email: '', password: '' });
        });
    };

    const runApiAction = async (action) => {
        try {
            setApiError('');
            await action();
        } catch (error) {
            setApiError(error.message);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            let nextReminder = '';

            tasks.forEach((task) => {
                if (!task.dueDate || !task.reminderTime || task.completed || task.remindedAt) {
                    return;
                }

                const reminderDate = new Date(`${task.dueDate}T${task.reminderTime}:00`);
                if (now >= reminderDate) {
                    nextReminder = `${task.title} is due at ${formatTime(task.reminderTime)}.`;
                    setTasks((currentTasks) =>
                        currentTasks.map((item) =>
                            item.id === task.id ? { ...item, remindedAt: now.toISOString() } : item
                        )
                    );
                }
            });

            if (nextReminder) {
                setReminderMessage(nextReminder);
            }
        }, 15000);

        return () => clearInterval(timer);
    }, [tasks]);

    const completedCount = tasks.filter((task) => task.completed).length;
    const activeCount = tasks.length - completedCount;
    const overdueCount = tasks.filter((task) => {
        if (!task.dueDate || task.completed) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(task.dueDate + 'T00:00:00');
        return due < today;
    }).length;

    const calendarDays = useMemo(() => {
        const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const firstDayIndex = start.getDay();
        const firstVisibleDate = new Date(start);
        firstVisibleDate.setDate(start.getDate() - firstDayIndex);

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(firstVisibleDate);
            date.setDate(firstVisibleDate.getDate() + index);
            return date;
        });
    }, [calendarMonth]);

    const selectedDateTasks = useMemo(
        () => tasks.filter((task) => task.dueDate === selectedDate),
        [selectedDate, tasks]
    );

    const filteredTasks = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        const filtered = tasks.filter((task) => {
            const matchesSearch =
                !normalizedSearch || task.title.toLowerCase().includes(normalizedSearch);
            const matchesFilter =
                filter === 'all' ||
                (filter === 'active' && !task.completed) ||
                (filter === 'completed' && task.completed);

            return matchesSearch && matchesFilter;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'priority') {
                return getPriorityValue(b.priority) - getPriorityValue(a.priority);
            }

            if (sortBy === 'dueSoonest') {
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            }

            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }, [filter, search, sortBy, tasks]);

    if (authLoading) {
        return <div className="page-shell"><div className="app-card"><div className="loading-state">Checking login...</div></div></div>;
    }

    if (!user) {
        return (
            <div className="page-shell">
                <form className="auth-card" onSubmit={handleAuth}>
                    <p className="eyebrow">TaskFlow account</p>
                    <h1>{authMode === 'login' ? 'Welcome back' : authMode === 'register' ? 'Create account' : authMode === 'forgot' ? 'Recover account' : 'Set new password'}</h1>
                    {apiError && <div className="api-error" role="alert">{apiError}</div>}
                    {authMode === 'register' && (
                        <input type="text" placeholder="Your name" value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} />
                    )}
                    <input type="email" placeholder="Email address" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} required />
                    {authMode !== 'forgot' && (
                        <div className="password-field">
                            <input type={passwordVisible ? 'text' : 'password'} placeholder="Password (6+ characters)" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} minLength="6" required />
                            <button type="button" className="password-toggle" onClick={() => setPasswordVisible((current) => !current)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>
                                {passwordVisible ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    )}
                    {authMode === 'reset' && resetToken && <input type="text" placeholder="Reset code" value={resetToken} onChange={(event) => setResetToken(event.target.value)} required />}
                    <button type="submit" className="primary-btn">{authMode === 'login' ? 'Log in' : authMode === 'register' ? 'Sign up' : authMode === 'forgot' ? 'Get reset code' : 'Reset password'}</button>
                    {authMode === 'login' && <button type="button" className="link-btn" onClick={() => { setAuthMode('forgot'); setApiError(''); }}>Forgot password?</button>}
                    <button type="button" className="ghost-btn" onClick={() => setAuthMode((current) => current === 'login' ? 'register' : 'login')}>
                        {authMode === 'login' ? 'Create an account' : 'Back to log in'}
                    </button>
                    {authMode === 'forgot' && resetToken && <button type="button" className="ghost-btn" onClick={() => setAuthMode('reset')}>Continue with reset code</button>}
                </form>
            </div>
        );
    }

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.title.trim()) {
            return;
        }

        const newTask = {
            id: makeId(),
            title: formData.title.trim(),
            dueDate: formData.dueDate,
            reminderTime: formData.reminderTime,
            priority: formData.priority,
            completed: false,
            createdAt: new Date().toISOString(),
        };

        await runApiAction(async () => {
            const savedTask = await createTask(newTask);
            setTasks((currentTasks) => [savedTask, ...currentTasks]);
        });
        setFormData({ title: '', dueDate: '', reminderTime: '', priority: 'Medium' });
    };

    const toggleTask = async (taskId) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;

        await runApiAction(async () => {
            const changedTask = { ...task, completed: !task.completed };
            await updateTask(changedTask);
            setTasks((currentTasks) =>
                currentTasks.map((item) => item.id === taskId ? changedTask : item)
            );
        });
    };

    const deleteTask = async (taskId) => {
        await runApiAction(async () => {
            await removeTask(taskId);
            setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
            if (editingId === taskId) setEditingId(null);
        });
    };

    const clearCompleted = async () => {
        await runApiAction(async () => {
            await Promise.all(tasks.filter((task) => task.completed).map((task) => removeTask(task.id)));
            setTasks((currentTasks) => currentTasks.filter((task) => !task.completed));
            setEditingId(null);
        });
    };

    const beginEdit = (task) => {
        setEditingId(task.id);
        setEditForm({
            title: task.title,
            dueDate: task.dueDate,
            reminderTime: task.reminderTime || '',
            priority: task.priority,
        });
    };

    const saveEdit = async (taskId) => {
        if (!editForm.title.trim()) return;

        await runApiAction(async () => {
            const editedTask = {
                ...tasks.find((task) => task.id === taskId),
                title: editForm.title.trim(),
                dueDate: editForm.dueDate,
                reminderTime: editForm.reminderTime,
                priority: editForm.priority,
            };
            await updateTask(editedTask);
            setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId ? editedTask : task));
        });

        setEditingId(null);
    };

    const handleDrop = async (targetId) => {
        if (!draggedTaskId || draggedTaskId === targetId) {
            setDraggedTaskId(null);
            return;
        }

        const reordered = [...tasks];
        const sourceIndex = reordered.findIndex((task) => task.id === draggedTaskId);
        const targetIndex = reordered.findIndex((task) => task.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) {
            setDraggedTaskId(null);
            return;
        }

        const [movedTask] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, movedTask);
        setTasks(reordered);
        await runApiAction(() => reorderTasks(reordered.map((task) => task.id)));

        setDraggedTaskId(null);
    };

    return (
        <div className="page-shell">
            <div className="app-card">
                {apiError && <div className="api-error" role="alert">{apiError}</div>}
                {loading && <div className="loading-state">Loading tasks...</div>}
                <header className="topbar">
                    <div>
                        <p className="eyebrow">Plan your day</p>
                        <h1>TaskFlow</h1>
                        <p className="signed-in-as">Signed in as {user.name}</p>
                    </div>

                    <div className="topbar-actions">
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                        >
                            {theme === 'light' ? 'Dark mode' : 'Light mode'}
                        </button>
                        <button
                            type="button"
                            className="secondary-btn"
                            onClick={clearCompleted}
                            disabled={completedCount === 0}
                        >
                            Clear completed
                        </button>
                        <button type="button" className="secondary-btn" onClick={async () => { await logout(); setUser(null); setTasks([]); }}>
                            Log out
                        </button>
                    </div>
                </header>

                <form className="task-form" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(event) =>
                            setFormData((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Add a task..."
                        aria-label="Task title"
                    />

                    <div className="task-form-row">
                        <input
                            type="date"
                            value={formData.dueDate}
                            onChange={(event) =>
                                setFormData((current) => ({ ...current, dueDate: event.target.value }))
                            }
                            aria-label="Due date"
                        />
                        <input
                            type="time"
                            value={formData.reminderTime}
                            onChange={(event) =>
                                setFormData((current) => ({ ...current, reminderTime: event.target.value }))
                            }
                            aria-label="Reminder time"
                        />
                        <select
                            value={formData.priority}
                            onChange={(event) =>
                                setFormData((current) => ({ ...current, priority: event.target.value }))
                            }
                            aria-label="Task priority"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                        <button type="submit" className="primary-btn">Add</button>
                    </div>
                </form>

                <div className="toolbar">
                    <div className="filter-group">
                        {['all', 'active', 'completed'].map((option) => (
                            <button
                                key={option}
                                type="button"
                                className={filter === option ? 'filter-btn active' : 'filter-btn'}
                                onClick={() => setFilter(option)}
                            >
                                {option === 'all' ? 'All' : option === 'active' ? 'Active' : 'Done'}
                            </button>
                        ))}
                    </div>

                    <div className="toolbar-right">
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search tasks"
                            aria-label="Search tasks"
                        />
                        <select
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value)}
                            aria-label="Sort tasks"
                        >
                            <option value="newest">Newest</option>
                            <option value="dueSoonest">Due soonest</option>
                            <option value="priority">Priority</option>
                        </select>
                    </div>
                </div>

                <div className="stats-row">
                    <div className="stat-card">
                        <span>Remaining</span>
                        <strong>{activeCount}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Completed</span>
                        <strong>{completedCount}</strong>
                    </div>
                    <div className="stat-card warning">
                        <span>Overdue</span>
                        <strong>{overdueCount}</strong>
                    </div>
                </div>

                <div className="priority-badges">
                    {['High', 'Medium', 'Low'].map((priority) => (
                        <span key={priority} className={`priority-count ${priority.toLowerCase()}`}>
                            {priority} <strong>{tasks.filter((task) => task.priority === priority).length}</strong>
                        </span>
                    ))}
                </div>

                <section className="calendar-panel">
                    <div className="calendar-header">
                        <button
                            type="button"
                            className="ghost-btn"
                            onClick={() =>
                                setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
                            }
                        >
                            Prev
                        </button>
                        <h2>
                            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarMonth)}
                        </h2>
                        <button
                            type="button"
                            className="ghost-btn"
                            onClick={() =>
                                setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
                            }
                        >
                            Next
                        </button>
                    </div>

                    <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="weekday-label">{day}</div>
                        ))}

                        {calendarDays.map((day) => {
                            const key = formatDateKey(day);
                            const dayTasks = tasks.filter((task) => task.dueDate === key);
                            const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                            const isSelected = selectedDate === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={`calendar-day ${isCurrentMonth ? '' : 'muted'} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedDate(key)}
                                >
                                    <span className="date-number">{day.getDate()}</span>
                                    <div className="calendar-task-stack">
                                        {dayTasks.slice(0, 3).map((task) => (
                                            <span key={task.id} className={`mini-badge ${task.priority.toLowerCase()}`}>
                                                {task.title}
                                            </span>
                                        ))}
                                        {dayTasks.length > 3 && <span className="more-tasks">+{dayTasks.length - 3}</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="selected-date-panel">
                        <h3>{selectedDate ? formatDate(selectedDate) : 'Select a date'}</h3>
                        {selectedDateTasks.length > 0 ? (
                            <ul>
                                {selectedDateTasks.map((task) => (
                                    <li key={task.id} className={task.completed ? 'selected-task completed' : 'selected-task'}>
                                        <span>{task.title}</span>
                                        <small>{task.reminderTime ? `Reminder: ${formatTime(task.reminderTime)}` : 'No reminder'}</small>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No tasks scheduled for this date.</p>
                        )}
                    </div>
                </section>

                {reminderMessage && (
                    <div className="reminder-banner">
                        <strong>Reminder:</strong> {reminderMessage}
                        <button type="button" className="close-banner" onClick={() => setReminderMessage('')}>×</button>
                    </div>
                )}

                <ul className="task-list">
                    {filteredTasks.length === 0 ? (
                        <li className="empty-state">No tasks match your current view.</li>
                    ) : (
                        filteredTasks.map((task) => {
                            const isEditing = editingId === task.id;
                            const overdue =
                                task.dueDate && !task.completed && new Date(task.dueDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));

                            return (
                                <li
                                    key={task.id}
                                    draggable={!isEditing}
                                    onDragStart={() => setDraggedTaskId(task.id)}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => handleDrop(task.id)}
                                    className={task.completed ? 'task-item completed' : 'task-item'}
                                >
                                    <label className="task-main">
                                        <input
                                            type="checkbox"
                                            checked={task.completed}
                                            onChange={() => toggleTask(task.id)}
                                            aria-label={`Mark ${task.title} complete`}
                                        />

                                        {isEditing ? (
                                            <div className="edit-form">
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={(event) =>
                                                        setEditForm((current) => ({ ...current, title: event.target.value }))
                                                    }
                                                />
                                                <div className="edit-form-row">
                                                    <input
                                                        type="date"
                                                        value={editForm.dueDate}
                                                        onChange={(event) =>
                                                            setEditForm((current) => ({ ...current, dueDate: event.target.value }))
                                                        }
                                                    />
                                                    <input
                                                        type="time"
                                                        value={editForm.reminderTime}
                                                        onChange={(event) =>
                                                            setEditForm((current) => ({ ...current, reminderTime: event.target.value }))
                                                        }
                                                    />
                                                    <select
                                                        value={editForm.priority}
                                                        onChange={(event) =>
                                                            setEditForm((current) => ({ ...current, priority: event.target.value }))
                                                        }
                                                    >
                                                        <option value="Low">Low</option>
                                                        <option value="Medium">Medium</option>
                                                        <option value="High">High</option>
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="task-content">
                                                <span className="task-title">{task.title}</span>
                                                <div className="task-meta">
                                                    <span className={`priority priority-${task.priority.toLowerCase()}`}>
                                                        {task.priority}
                                                    </span>
                                                    <span className={overdue ? 'due-date overdue' : 'due-date'}>
                                                        {formatDate(task.dueDate)}
                                                    </span>
                                                    {task.reminderTime && (
                                                        <span className="reminder-pill">{formatTime(task.reminderTime)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </label>

                                    <div className="task-actions">
                                        {isEditing ? (
                                            <>
                                                <button type="button" className="save-btn" onClick={() => saveEdit(task.id)}>
                                                    Save
                                                </button>
                                                <button type="button" className="ghost-btn" onClick={() => setEditingId(null)}>
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" className="ghost-btn" onClick={() => beginEdit(task)}>
                                                    Edit
                                                </button>
                                                <button type="button" className="delete-btn" onClick={() => deleteTask(task.id)}>
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
}

export default App;
