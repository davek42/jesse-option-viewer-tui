# Option Viewer Global Input Handler Pattern for React + Ink TUI Applications

## Overview

The Global Input Handler pattern centralizes all keyboard input processing in a single location, making it easier to reason about input flow, manage screen transitions, and handle command modes. This is often simpler and more maintainable than distributed input handlers.

## Core Concepts

### 1. Screen Management
Track which screen is currently active and route input accordingly.

### 2. Mode System
Different modes change how input is interpreted:
- **Navigation Mode**: Single-key commands for quick actions
- **Input Mode**: Text entry for forms, searches, etc.
- **Command Mode**: Multi-character commands prefixed with `/`

### 3. Single-Key Commands
Common actions accessible via single keypresses (when not in input mode).

### 4. Slash Commands
Multi-character commands that start with `/` for advanced operations.

---

## Implementation

### Core State Management

```javascript
// store/appSlice.js
import { createSlice } from '@reduxjs/toolkit';

const appSlice = createSlice({
  name: 'app',
  initialState: {
    // Screen management
    currentScreen: 'taskList',      // 'taskList', 'settings', 'help', etc.
    screenHistory: ['taskList'],
    
    // Mode management
    mode: 'navigation',              // 'navigation', 'input', 'command'
    
    // Input state
    inputBuffer: '',                 // For input/command modes
    commandBuffer: '',               // Specifically for slash commands
    
    // Navigation state (per screen)
    selectedIndex: {
      taskList: 0,
      settings: 0
    },
    
    // Status
    statusMessage: '',
    statusType: 'info'               // 'info', 'success', 'error', 'warning'
  },
  
  reducers: {
    // Screen navigation
    setScreen: (state, action) => {
      state.screenHistory.push(action.payload);
      state.currentScreen = action.payload;
      state.mode = 'navigation';
      state.inputBuffer = '';
      state.commandBuffer = '';
    },
    
    goBack: (state) => {
      if (state.screenHistory.length > 1) {
        state.screenHistory.pop();
        state.currentScreen = state.screenHistory[state.screenHistory.length - 1];
        state.mode = 'navigation';
      }
    },
    
    // Mode management
    setMode: (state, action) => {
      state.mode = action.payload;
      if (action.payload === 'navigation') {
        state.inputBuffer = '';
        state.commandBuffer = '';
      }
    },
    
    // Input handling
    appendInput: (state, action) => {
      if (state.mode === 'command') {
        state.commandBuffer += action.payload;
      } else {
        state.inputBuffer += action.payload;
      }
    },
    
    deleteLastChar: (state) => {
      if (state.mode === 'command') {
        state.commandBuffer = state.commandBuffer.slice(0, -1);
        // Exit command mode if buffer becomes empty
        if (state.commandBuffer === '') {
          state.mode = 'navigation';
        }
      } else {
        state.inputBuffer = state.inputBuffer.slice(0, -1);
      }
    },
    
    clearInput: (state) => {
      state.inputBuffer = '';
      state.commandBuffer = '';
    },
    
    // Navigation within screens
    moveSelection: (state, action) => {
      const { screen, direction, max } = action.payload;
      const current = state.selectedIndex[screen] || 0;
      
      if (direction === 'up') {
        state.selectedIndex[screen] = Math.max(0, current - 1);
      } else if (direction === 'down') {
        state.selectedIndex[screen] = Math.min(max, current + 1);
      }
    },
    
    resetSelection: (state, action) => {
      state.selectedIndex[action.payload] = 0;
    },
    
    // Status messages
    setStatus: (state, action) => {
      state.statusMessage = action.payload.message;
      state.statusType = action.payload.type || 'info';
    },
    
    clearStatus: (state) => {
      state.statusMessage = '';
    }
  }
});

export const {
  setScreen,
  goBack,
  setMode,
  appendInput,
  deleteLastChar,
  clearInput,
  moveSelection,
  resetSelection,
  setStatus,
  clearStatus
} = appSlice.actions;

export default appSlice.reducer;
```

### Global Input Handler

```javascript
// components/GlobalInputHandler.js
import { useInput, useApp } from 'ink';
import { useDispatch, useSelector } from 'react-redux';
import {
  setScreen,
  goBack,
  setMode,
  appendInput,
  deleteLastChar,
  clearInput,
  moveSelection,
  setStatus
} from '../store/appSlice';
import { addTask, toggleTask, deleteTask } from '../store/taskSlice';

export function GlobalInputHandler() {
  const dispatch = useDispatch();
  const { exit } = useApp();
  const { currentScreen, mode, inputBuffer, commandBuffer, selectedIndex } = useSelector(
    state => state.app
  );
  const tasks = useSelector(state => state.tasks.items);
  
  useInput((input, key) => {
    // ==========================================
    // GLOBAL SHORTCUTS (work in any mode)
    // ==========================================
    
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    
    // ==========================================
    // COMMAND MODE (slash commands)
    // ==========================================
    
    if (mode === 'command') {
      handleCommandMode(input, key);
      return;
    }
    
    // ==========================================
    // INPUT MODE (text entry)
    // ==========================================
    
    if (mode === 'input') {
      handleInputMode(input, key);
      return;
    }
    
    // ==========================================
    // NAVIGATION MODE (single-key commands)
    // ==========================================
    
    // Check for slash command initiation
    if (input === '/') {
      dispatch(setMode('command'));
      dispatch(appendInput('/'));
      return;
    }
    
    // Handle based on current screen
    switch (currentScreen) {
      case 'taskList':
        handleTaskListNavigation(input, key);
        break;
      case 'settings':
        handleSettingsNavigation(input, key);
        break;
      case 'help':
        handleHelpNavigation(input, key);
        break;
      default:
        break;
    }
  });
  
  // ==========================================
  // COMMAND MODE HANDLER
  // ==========================================
  
  function handleCommandMode(input, key) {
    if (key.escape) {
      dispatch(clearInput());
      dispatch(setMode('navigation'));
      return;
    }
    
    if (key.backspace || key.delete) {
      dispatch(deleteLastChar());
      return;
    }
    
    if (key.return) {
      executeCommand(commandBuffer);
      dispatch(clearInput());
      dispatch(setMode('navigation'));
      return;
    }
    
    // Append character to command buffer
    if (input && !key.ctrl && !key.meta) {
      dispatch(appendInput(input));
    }
  }
  
  // ==========================================
  // INPUT MODE HANDLER
  // ==========================================
  
  function handleInputMode(input, key) {
    if (key.escape) {
      dispatch(clearInput());
      dispatch(setMode('navigation'));
      return;
    }
    
    if (key.return) {
      submitInput(inputBuffer);
      dispatch(clearInput());
      dispatch(setMode('navigation'));
      return;
    }
    
    if (key.backspace || key.delete) {
      dispatch(deleteLastChar());
      return;
    }
    
    // Append character to input buffer
    if (input && !key.ctrl && !key.meta) {
      dispatch(appendInput(input));
    }
  }
  
  // ==========================================
  // TASK LIST NAVIGATION
  // ==========================================
  
  function handleTaskListNavigation(input, key) {
    const currentIndex = selectedIndex.taskList || 0;
    const maxIndex = tasks.length - 1;
    
    // Navigation
    if (key.upArrow || input === 'k') {
      dispatch(moveSelection({ 
        screen: 'taskList', 
        direction: 'up', 
        max: maxIndex 
      }));
    } else if (key.downArrow || input === 'j') {
      dispatch(moveSelection({ 
        screen: 'taskList', 
        direction: 'down', 
        max: maxIndex 
      }));
    }
    
    // Single-key commands
    else if (input === 'a') {
      dispatch(setMode('input'));
      dispatch(setStatus({ 
        message: 'Enter task name (ESC to cancel)', 
        type: 'info' 
      }));
    }
    else if (input === 't' && tasks[currentIndex]) {
      dispatch(toggleTask(tasks[currentIndex].id));
    }
    else if (input === 'd' && tasks[currentIndex]) {
      dispatch(deleteTask(tasks[currentIndex].id));
      dispatch(setStatus({ 
        message: 'Task deleted', 
        type: 'success' 
      }));
    }
    else if (input === 's') {
      dispatch(setScreen('settings'));
    }
    else if (input === 'h' || input === '?') {
      dispatch(setScreen('help'));
    }
    else if (input === 'q') {
      exit();
    }
  }
  
  // ==========================================
  // SETTINGS NAVIGATION
  // ==========================================
  
  function handleSettingsNavigation(input, key) {
    if (key.escape || input === 'q') {
      dispatch(goBack());
    }
    // Add more settings-specific navigation
  }
  
  // ==========================================
  // HELP NAVIGATION
  // ==========================================
  
  function handleHelpNavigation(input, key) {
    if (key.escape || input === 'q') {
      dispatch(goBack());
    }
  }
  
  // ==========================================
  // INPUT SUBMISSION
  // ==========================================
  
  function submitInput(value) {
    if (!value.trim()) return;
    
    switch (currentScreen) {
      case 'taskList':
        dispatch(addTask(value.trim()));
        dispatch(setStatus({ 
          message: 'Task added', 
          type: 'success' 
        }));
        break;
      // Handle other screens
      default:
        break;
    }
  }
  
  // ==========================================
  // COMMAND EXECUTION
  // ==========================================
  
  function executeCommand(cmd) {
    const command = cmd.toLowerCase().trim();
    
    // Remove leading slash if present
    const cleanCmd = command.startsWith('/') ? command.slice(1) : command;
    
    // Parse command and arguments
    const [action, ...args] = cleanCmd.split(' ');
    
    switch (action) {
      case 'exit':
      case 'quit':
      case 'q':
        exit();
        break;
        
      case 'help':
      case 'h':
        dispatch(setScreen('help'));
        break;
        
      case 'settings':
      case 'config':
        dispatch(setScreen('settings'));
        break;
        
      case 'tasks':
      case 'list':
        dispatch(setScreen('taskList'));
        break;
        
      case 'add':
        if (args.length > 0) {
          const taskText = args.join(' ');
          dispatch(addTask(taskText));
          dispatch(setStatus({ 
            message: 'Task added', 
            type: 'success' 
          }));
        } else {
          dispatch(setStatus({ 
            message: 'Usage: /add <task description>', 
            type: 'error' 
          }));
        }
        break;
        
      case 'delete':
      case 'del':
        if (args.length > 0) {
          const index = parseInt(args[0], 10);
          if (!isNaN(index) && tasks[index]) {
            dispatch(deleteTask(tasks[index].id));
            dispatch(setStatus({ 
              message: `Task ${index} deleted`, 
              type: 'success' 
            }));
          } else {
            dispatch(setStatus({ 
              message: 'Invalid task index', 
              type: 'error' 
            }));
          }
        }
        break;
        
      case 'clear':
        // Clear all completed tasks
        const completedTasks = tasks.filter(t => t.completed);
        completedTasks.forEach(task => dispatch(deleteTask(task.id)));
        dispatch(setStatus({ 
          message: `Cleared ${completedTasks.length} completed tasks`, 
          type: 'success' 
        }));
        break;
        
      default:
        dispatch(setStatus({ 
          message: `Unknown command: ${action}. Type /help for available commands`, 
          type: 'error' 
        }));
        break;
    }
  }
  
  // This component doesn't render anything
  return null;
}
```

### UI Components

```javascript
// components/StatusBar.js
import React from 'react';
import { Box, Text } from 'ink';
import { useSelector } from 'react-redux';

export function StatusBar() {
  const { mode, inputBuffer, commandBuffer, statusMessage, statusType } = useSelector(
    state => state.app
  );
  
  const statusColor = {
    info: 'blue',
    success: 'green',
    error: 'red',
    warning: 'yellow'
  }[statusType] || 'white';
  
  return (
    <Box 
      borderStyle="single" 
      paddingX={1} 
      justifyContent="space-between"
    >
      <Box>
        {/* Mode indicator */}
        <Text bold>
          {mode === 'navigation' && '[ NAVIGATION ]'}
          {mode === 'input' && '[ INPUT ]'}
          {mode === 'command' && '[ COMMAND ]'}
        </Text>
        
        {/* Input/Command buffer */}
        {(mode === 'input' || mode === 'command') && (
          <Text> {commandBuffer || inputBuffer}<Text backgroundColor="white" color="black">█</Text></Text>
        )}
      </Box>
      
      {/* Status message */}
      {statusMessage && (
        <Text color={statusColor}>{statusMessage}</Text>
      )}
    </Box>
  );
}
```

```javascript
// components/KeyboardHelp.js
import React from 'react';
import { Box, Text } from 'ink';
import { useSelector } from 'react-redux';

export function KeyboardHelp() {
  const { currentScreen } = useSelector(state => state.app);
  
  const shortcuts = {
    taskList: [
      { key: '↑/j', desc: 'Move up' },
      { key: '↓/k', desc: 'Move down' },
      { key: 'a', desc: 'Add task' },
      { key: 't', desc: 'Toggle complete' },
      { key: 'd', desc: 'Delete task' },
      { key: 's', desc: 'Settings' },
      { key: 'h/?', desc: 'Help' },
      { key: '/', desc: 'Command mode' },
      { key: 'q', desc: 'Quit' }
    ],
    settings: [
      { key: 'ESC/q', desc: 'Back' }
    ],
    help: [
      { key: 'ESC/q', desc: 'Back' }
    ]
  };
  
  const currentShortcuts = shortcuts[currentScreen] || [];
  
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold dimColor>Keyboard Shortcuts:</Text>
      <Box flexDirection="row" flexWrap="wrap">
        {currentShortcuts.map((shortcut, i) => (
          <Box key={i} marginRight={2}>
            <Text color="cyan">{shortcut.key}</Text>
            <Text dimColor> {shortcut.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

```javascript
// App.js - Main application
import React from 'react';
import { Box } from 'ink';
import { Provider, useSelector } from 'react-redux';
import { store } from './store';
import { GlobalInputHandler } from './components/GlobalInputHandler';
import { StatusBar } from './components/StatusBar';
import { KeyboardHelp } from './components/KeyboardHelp';
import { TaskListScreen } from './screens/TaskListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';

function AppContent() {
  const { currentScreen } = useSelector(state => state.app);
  
  return (
    <Box flexDirection="column" height="100%">
      <GlobalInputHandler />
      
      {/* Main content area */}
      <Box flex={1} flexDirection="column">
        {currentScreen === 'taskList' && <TaskListScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
        {currentScreen === 'help' && <HelpScreen />}
      </Box>
      
      {/* Keyboard shortcuts help */}
      <KeyboardHelp />
      
      {/* Status bar at bottom */}
      <StatusBar />
    </Box>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}
```

---

## Command Reference

### Single-Key Commands (Navigation Mode)

#### Task List Screen
| Key | Action |
|-----|--------|
| `↑` or `k` | Move selection up |
| `↓` or `j` | Move selection down |
| `a` | Add new task (enters input mode) |
| `t` | Toggle task completion |
| `d` | Delete selected task |
| `s` | Go to settings |
| `h` or `?` | Show help |
| `/` | Enter command mode |
| `q` | Quit application |

#### Settings Screen
| Key | Action |
|-----|--------|
| `ESC` or `q` | Go back |

### Slash Commands (Command Mode)

Type `/` followed by command and press Enter:

| Command | Description | Example |
|---------|-------------|---------|
| `/exit`, `/quit`, `/q` | Exit application | `/exit` |
| `/help`, `/h` | Show help screen | `/help` |
| `/settings`, `/config` | Go to settings | `/settings` |
| `/tasks`, `/list` | Go to task list | `/tasks` |
| `/add <text>` | Add new task | `/add Buy groceries` |
| `/delete <index>`, `/del <index>` | Delete task by index | `/delete 0` |
| `/clear` | Clear all completed tasks | `/clear` |

### Input Mode

When in input mode (after pressing `a`):
- Type normally to enter text
- `Enter` - Submit input
- `ESC` - Cancel and return to navigation
- `Backspace` - Delete last character

### Command Mode

When in command mode (after pressing `/`):
- Type command and arguments
- `Enter` - Execute command
- `ESC` - Cancel and return to navigation
- `Backspace` - Delete last character
- If you delete all characters, automatically returns to navigation mode

---

## Advantages of This Pattern

### ✅ Centralized Logic
- All input handling in one place
- Easy to understand the entire input flow
- Single source of truth for keyboard shortcuts

### ✅ Clear Mode Separation
- Explicit modes prevent conflicts
- Visual feedback shows current mode
- Each mode has distinct behavior

### ✅ Extensible Command System
- Easy to add new slash commands
- Commands can accept arguments
- Can implement command aliases

### ✅ Screen-Based Routing
- Different screens have different shortcuts
- Screen history for back navigation
- Easy to add new screens

### ✅ Consistent Status Feedback
- Centralized status messaging
- Color-coded message types
- Always visible to user

---

## Best Practices

### 1. Mode Discipline
Always set mode explicitly when transitioning:
```javascript
// Good
dispatch(setMode('input'));

// Bad
// Forgetting to set mode can cause confusion
```

### 2. Clear Buffer on Mode Exit
Always clear input buffers when leaving input/command mode:
```javascript
if (key.escape) {
  dispatch(clearInput());
  dispatch(setMode('navigation'));
}
```

### 3. Provide Visual Feedback
Always show:
- Current mode in status bar
- Input buffer with cursor
- Status messages for actions
- Which element is selected

### 4. Document Commands
Keep an up-to-date help screen with:
- All single-key commands per screen
- All slash commands
- Examples of command usage

### 5. Graceful Error Handling
For invalid commands or actions:
```javascript
dispatch(setStatus({ 
  message: 'Invalid command. Type /help for available commands', 
  type: 'error' 
}));
```

### 6. Consistent Key Bindings
Use familiar conventions:
- `j/k` or arrow keys for navigation (Vim-style)
- `q` to quit/go back
- `?` or `h` for help
- `ESC` to cancel/go back
- `/` for command entry (Vim-style)

---

## Comparison: Global Handler vs Focus Context

| Aspect | Global Handler | Focus Context |
|--------|----------------|---------------|
| **Complexity** | Lower - one handler | Higher - distributed handlers |
| **Maintainability** | Easier - centralized | Harder - scattered logic |
| **Debugging** | Easier - one place to look | Harder - multiple components |
| **Flexibility** | Medium - must route manually | High - components self-manage |
| **Best For** | Apps with clear screen/mode flow | Complex UIs with many interactive areas |
| **Input Flow** | Explicit routing in one place | Implicit via focus checks |

---

## When to Use Global Input Handler

✅ **Use this pattern when:**
- Your app has distinct screens/views
- You want a clear, centralized input handling flow
- You have a command system (`/commands`)
- Screen-based navigation is primary
- Team prefers centralized logic

❌ **Avoid this pattern when:**
- You have many simultaneous interactive areas
- Components need complete input autonomy
- Building a highly modular plugin system
- Complex focus management with nested interactions

---

## Summary

The Global Input Handler pattern provides:
- **Single source of truth** for all keyboard input
- **Clear mode system** for different input behaviors
- **Screen-based routing** for different UI states
- **Command system** with `/` prefix for advanced operations
- **Simple mental model** - one handler, explicit routing
- **Easy debugging** - all input logic in one place

**Key Rule:** The global handler receives ALL input and routes it based on current mode and screen. This makes the input flow explicit and easy to understand.
