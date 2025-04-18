import mongoose from 'mongoose';
import { User } from './User';
import { Party } from './Party';
import { Message } from './Message';

// Ensure models are registered in the correct order
export { User, Party, Message };

// Optional: Export mongoose instance if needed elsewhere
export default mongoose; 