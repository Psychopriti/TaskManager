import fs from 'fs';
import path from 'path';

const tasksFile = path.join(process.cwd(), 'data', 'tasks.json');

// Read tasks from JSON file
const readTasks = () => {
    if (!fs.existsSync(tasksFile)) return [];
    const data = fs.readFileSync(tasksFile, 'utf-8');
    return JSON.parse(data);
};

// Write tasks to JSON file
const writeTasks = (tasks) => {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2), 'utf-8');
};

// Get all tasks
export const getTasks = () => readTasks();

// Add a new task
export const addTask = (task) => {
    const tasks = readTasks();
    tasks.push({ id: Date.now().toString(), task });
    writeTasks(tasks);
};

// Delete a task
export const deleteTask = (id) => {
    let tasks = readTasks();
    tasks = tasks.filter((task) => task.id !== id);
    writeTasks(tasks);
};
