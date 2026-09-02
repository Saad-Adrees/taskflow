const API_URL = '/api/tasks.php';

async function request(url = API_URL, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'The API request failed.');
    }

    return data;
}

export const getTasks = () => request();
export const createTask = (task) => request(API_URL, { method: 'POST', body: JSON.stringify(task) });
export const updateTask = (task) => request(`${API_URL}?id=${task.id}`, { method: 'PUT', body: JSON.stringify(task) });
export const removeTask = (taskId) => request(`${API_URL}?id=${taskId}`, { method: 'DELETE' });
export const reorderTasks = (order) => request(`${API_URL}?order=1`, { method: 'PATCH', body: JSON.stringify({ order }) });
