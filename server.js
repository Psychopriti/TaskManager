import express from 'express';
import { engine as exphbs } from 'express-handlebars'; // Correct import
import fs from 'fs';
import path from 'path';
import session from 'express-session'; // Import express-session
import FileStore from 'session-file-store'; // Import session-file-store
import Handlebars from 'handlebars';

Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});
const app = express();
const PORT = process.env.PORT || 3000;

// Use FileStore for session persistence
const fileStore = FileStore(session);

// Set Handlebars as the view engine
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

// Set the views directory
app.set('views', path.join(process.cwd(), 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use((req, res, next) => {
    if (req.session && req.session.user) {
        console.log('User session:', req.session.user);
    }
    next();
});

// Session Middleware with FileStore
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: new fileStore({
        path: path.join(process.cwd(), 'sessions'),
        ttl: 3600, // Session TTL set to 1 hour (in seconds)
    }),
    cookie: {
        httpOnly: true, // Prevent JavaScript from accessing cookies
        secure: false,  // Set to true if using HTTPS
        maxAge: 3600000 // Session expires in 1 hour (in milliseconds)
    }
}));


// File paths
const tasksFile = path.join(process.cwd(), 'data', 'tasks.json');
const usersFile = path.join(process.cwd(), 'data', 'users.json');

// Helper functions
const readFile = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf-8');
    return data ? JSON.parse(data) : []; // Check if data is empty
};

const writeFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Task Operations
const getTasks = (username) => {
    const tasks = readFile(tasksFile);
    return tasks.filter((task) => task.user === username);
};

const addTask = (task, username) => {
    const tasks = readFile(tasksFile);
    tasks.push({ ...task, id: Date.now().toString(), user: username });
    writeFile(tasksFile, tasks);
};

const deleteTask = (id) => {
    let tasks = readFile(tasksFile);
    tasks = tasks.filter((task) => task.id !== id);
    writeFile(tasksFile, tasks);
};

const updateTask = (updatedTask) => {
    const tasks = readFile(tasksFile);
    const taskIndex = tasks.findIndex((task) => task.id === updatedTask.id);
    if (taskIndex !== -1) {
        tasks[taskIndex] = updatedTask; // Update task in the array
        writeFile(tasksFile, tasks); // Write the updated task list back to the file
    }
};

// User Operations
const getUsers = () => readFile(usersFile);

const addUser = (username) => {
    const users = getUsers();
    users.push({ username });
    writeFile(usersFile, users);
};

// Routes
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const tasks = getTasks(req.session.user);
    res.render('home', { tasks, loggedInUser: req.session.user });
});

// Tasks Routes
app.get('/tasks', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const tasks = getTasks(req.session.user);
    res.render('home', { tasks, loggedInUser: req.session.user });
});

app.post('/tasks', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const { title, description, due_date, priority } = req.body;
    const task = {title, description, due_date, priority, status: 'Pending' };
    addTask(task, req.session.user);
    res.redirect('/tasks');
});

// Route to display the Add Task form
app.get('/tasks/add', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('add-task'); // Render the 'add-task' view if logged in
});

app.get('/tasks/edit/:id', (req, res) => {
    const { id } = req.params;
    const tasks = getTasks(req.session.user);
    const taskToEdit = tasks.find((task) => task.id === id);
    if (!taskToEdit) {
        return res.status(404).send('Task not found');
    }
    res.render('edit-task', { task: taskToEdit });
});


app.post('/tasks/edit/:id', (req, res) => {
    const { id } = req.params;
    const { title, description, due_date, priority, completion_date } = req.body;
    
    // Get the current task (including user and status)
    const taskToEdit = getTasks(req.session.user).find((task) => task.id === id);
    
    if (!taskToEdit) {
        return res.status(404).send('Task not found');
    }
    
    // Maintain the user and status
    const updatedTask = {
        id,
        title: title || taskToEdit.title,
        description: description || taskToEdit.description,
        due_date: due_date || taskToEdit.due_date,
        priority: priority || taskToEdit.priority,
        status: taskToEdit.status, // Keep the current status
        user: taskToEdit.user, // Keep the user who created the task
        completion_date: completion_date || taskToEdit.completion_date
    };

    // Update the task with the new values
    updateTask(updatedTask);
    res.redirect('/tasks'); // Redirect to the task list after editing
});

// Route to mark task as complete
app.post('/tasks/complete/:id', (req, res) => {
    const { id } = req.params;
    const tasks = getTasks(req.session.user);
    const taskToComplete = tasks.find((task) => task.id === id);

    if (!taskToComplete) {
        return res.status(404).send('Task not found');
    }

    taskToComplete.status = 'Completed'; // Change task status
    updateTask(taskToComplete); // Save updated task

    res.redirect('/tasks'); // Redirect to tasks page
});

// Route to cancel task
app.post('/tasks/cancel/:id', (req, res) => {
    const { id } = req.params;
    const tasks = getTasks(req.session.user);
    const taskToCancel = tasks.find((task) => task.id === id);

    if (!taskToCancel) {
        return res.status(404).send('Task not found');
    }

    taskToCancel.status = 'Cancelled'; // Change task status to cancelled
    updateTask(taskToCancel); // Save updated task

    res.redirect('/tasks'); // Redirect back to tasks page
});

// Route to delete task
app.post('/tasks/delete/:id', (req, res) => {
    console.log('User Session:', req.session.user);  // Check the session value
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if no user session
    }

    const { id } = req.params;
    const tasks = getTasks(req.session.user);
    const taskToDelete = tasks.find((task) => task.id === id);

    if (!taskToDelete) {
        return res.status(404).send('Task not found');
    }

    deleteTask(id); // Delete the task from the file

    res.redirect('/tasks'); // Redirect to tasks page after deletion
});

// Login Route
app.get('/login', (req, res) => {
    res.render('login', { loggedInUser: null });
});

app.post('/login', (req, res) => {
    const { username } = req.body;
    const users = getUsers();
    if (!users.find((user) => user.username === username)) {
        return res.status(400).json({ message: 'User does not exist. Please register first.' });
    }
    req.session.user = username; // Store the username in the session
    console.log('Logged in as:', req.session.user); // Check if session is set
    res.redirect('/');
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.user = null; // Clear session
    res.redirect('/login');
});

// 🚀 Show registration page
app.get('/register', (req, res) => {
    res.render('register'); // This renders your register.handlebars
});


app.post('/register', (req, res) => {
    const { username } = req.body;
    const users = getUsers();
    if (users.find((user) => user.username === username)) {
        return res.status(400).json({ message: 'User already exists. Please log in.' });
    }
    addUser(username);
    console.log(`User registered: ${username}`);

    res.redirect('/login'); // Redirect to login after successful registration
});


// 404 Error Handler
app.use((req, res) => {
    res.status(404).render('404');
});

// 500 Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
