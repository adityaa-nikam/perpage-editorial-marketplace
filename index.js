import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path, { isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import initialize from './config/passport-config.js';
import connectDB from './config/db.js';
import writerRoutes from './routes/writers.js';
import methodOverride from 'method-override';
import { checkDatabaseHealth, startDatabaseMonitor } from './utils/dbHealthCheck.js';
import { icon } from './utils/icons.js';





// Route imports
import profile1 from './routes/profile1.js';
import profile from './routes/profile.js';
import about from './routes/about.js';
import authRoutes from './routes/auth.js';
import homeRoutes from './routes/home.js';
import dealRoutes from './routes/deal.js';
import dashboardRoutes from './routes/dashboard.js';


dotenv.config();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  console.warn('⚠️ Application will continue running, but this should be investigated');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error(error.stack);
  console.error('💀 Application will exit');
  process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate essential environment variables
const requiredEnvVars = ['MONGO_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

console.log('✅ Environment variables validated');

const app = express();
const port = process.env.PORT || 3000;

// // MongoDB Connection
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL);
//     console.log('✅ Connected to MongoDB');
//   } catch (err) {
//     console.error('❌ MongoDB connection error:', err);
//     throw err;
//   }
// };

// Middleware

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Middleware
app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'sessions',
    touchAfter: 24 * 3600, // lazy session update
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native'
  }).on('error', (error) => {
    console.error('❌ Session store error:', error.message);
    console.warn('⚠️ Sessions may not persist properly without database connection');
  })
}));

// Passport Initialization
try {
  initialize(passport);
  app.use(passport.initialize());
  app.use(passport.session());
  console.log('✅ Passport initialized successfully');
} catch (error) {
  console.error('❌ Passport initialization failed:', error.message);
  console.warn('⚠️ Authentication features may not work properly');
}

// View Helpers & Global State
app.locals.icon = icon;

// Expose user, currentPath, and flash/query messages to all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  if (process.env.NODE_ENV !== 'production' && req.query.mockUser === '1') {
    res.locals.user = {
      _id: '64f1a2b3c4d5e6f7a8b9c0d9',
      name: 'Eleanor Vance',
      email: 'eleanor@oxford.ac.uk',
      initials: 'EV'
    };
  }
  res.locals.currentPath = req.path || '/';
  res.locals.messages = {
    error: req.query.error || null,
    success: req.query.success || null,
    info: req.query.info || null
  };
  next();
});

// Method override for PUT and DELETE forms
app.use(methodOverride('_method'));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Dev-only styleguide route
if (process.env.NODE_ENV !== 'production') {
  app.get('/styleguide', (req, res) => {
    if (req.query.mockUser) {
      res.locals.user = {
        name: 'Eleanor Vance',
        email: 'eleanor@oxford.ac.uk',
        initials: 'EV'
      };
    }
    res.render('styleguide');
  });

  app.get('/mock-download/:key', (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'));
  });
}

// Route Mounting
app.use('/', authRoutes);         // /login, /register, /auth/google, etc.
app.use('/home', homeRoutes);     // /home (protected)
app.use('/deal', dealRoutes);     // /deal (uploads, forms)
app.use('/dashboard', dashboardRoutes); // /dashboard view
app.use('/writers', writerRoutes); // /writers (writer-specific routes)
app.use('/profile', profile);      // /profile/:id (writer profile)
app.use('/about', about);          // /about
app.use('/profile1', profile1); 

// Default Route - Directly renders home page to eliminate artificial delay and improve LCP
app.use('/', homeRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  console.error(err.stack);
  
  // Handle different types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation Error', details: err.message });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    return res.status(503).json({ 
      error: 'Database Error', 
      message: 'Please try again later. If the problem persists, check your internet connection.' 
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
    
  res.status(statusCode).json({ error: message });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({ error: 'Page not found' });
});

// Start Server
const startServer = async () => {
  try {
    console.log('🚀 Starting server...');
    
    // Try to connect to database
    try {
      await connectDB();
      console.log('✅ Database connection successful');
      
      // Start database monitoring after successful initial connection
      startDatabaseMonitor();
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      console.warn('⚠️ Server will start without database connection');
      console.warn('⚠️ Some features requiring database may not work');
      
      // Don't exit - allow server to start without DB for basic functionality
    }
    
    // Start the server regardless of DB connection status
    const server = app.listen(port, () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
      console.log('✅ Server started successfully');
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        console.error('Please close other applications using this port or use a different port');
      } else {
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(false, () => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close(false, () => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });
    
  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};


app.get('/api/test', (req, res) => {
  try {
    res.status(200).json({ 
      message: 'Hello from Express!', 
      status: 'Server is running',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
  } catch (error) {
    console.error('❌ Test API error:', error.message);
    res.status(500).json({ error: 'Test API failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  try {
    const dbHealth = checkDatabaseHealth();
    const health = {
      status: dbHealth.isHealthy ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth,
      memory: process.memoryUsage(),
      version: process.version
    };
    
    const statusCode = dbHealth.isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('❌ Health check error:', error.message);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});


startServer();
