const asyncWrap = (fn) => {
    return (req, res, next) => {
        try {
            const result = fn(req, res, next);
            
            // Check if the function returns a promise
            if (result && typeof result.catch === 'function') {
                result.catch((error) => {
                    console.error('❌ Async error caught by wrapper:', error.message);
                    
                    // Handle specific database errors
                    if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
                        console.error('❌ Database connection error in async operation');
                        error.statusCode = 503;
                        error.message = 'Database connection error. Please check your internet connection.';
                    }
                    
                    next(error);
                });
            }
        } catch (error) {
            console.error('❌ Sync error caught by wrapper:', error.message);
            next(error);
        }
    };
};

export { asyncWrap };