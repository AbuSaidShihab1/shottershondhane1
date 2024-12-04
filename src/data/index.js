
import bcrypt from 'bcryptjs';

const salt = await bcrypt.genSalt(10);
if (!salt) throw Error('Something went wrong with bcrypt');

const hash = await bcrypt.hash("admin1", salt);
if (!hash) throw Error('Something went wrong hashing the password');

export const dataUser = [
  {
    _id: "63701cc1f03239c72c000171",
    name: "Admin1",
    email: "admin1@easypay.com",
    password: hash,
    city: "aaa",
    state: null,
    country: "ID",
    occupation: "Computer Systems Analyst I",
    phoneNumber: "8346315874",
    transactions: [
      "63701d74f0323986f3000158",
      "63701d74f03239d40b00007e",
      "63701d74f03239867500014b",
      "63701d74f032398675000152",
    ],
    role: "admin",
  },
]