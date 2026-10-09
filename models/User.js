import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() { return !this.googleId  && !this.githubId } },
  name: { type: String},
  address: { type: String, default: '' },
  role: {
    type: String,
    enum: ['user', 'writer', 'admin'],
    default: 'user'
  },
  bio: { type: String, default: '' },
  
  googleId: { type: String },
  githubId:{type : String},
  profilePic: { type: String, default: '' }, // new
  pricePerPage: { type: Number, default: 0 },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", UserSchema);

export { UserSchema, User };
