import { useState } from "react";
import { Link } from "react-router";
import { GridPattern } from "@/components/magicui/grid-pattern";
import logo from "@/assets/logo.png";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle signup logic here
    if (password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    console.log("Signup:", { firstName, lastName, email, password });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="relative hidden w-2/3 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 lg:flex lg:items-center lg:justify-center overflow-hidden">
        <GridPattern
          width={40}
          height={40}
          className="absolute inset-0 h-full w-full stroke-white/10 fill-white/5"
          strokeDasharray="4 2"
        />
        <div className="relative z-10 max-w-md space-y-10 px-8 text-white">
          <div className="space-y-10">
            <div className="flex flex-col items-start gap-3">
              <h1 className="text-7xl font-semibold tracking-tight">
                Hello
                <br />
                Flow Nova!
              </h1>
            </div>
            <div className="h-1 w-20 bg-white/30 rounded-full" />
          </div>
          <p className="text-lg text-white/90 leading-relaxed">
            Skip repetitive and manual workflow tasks. Get highly productive
            through automation and save tons of time!
          </p>
          <p className="text-sm text-white/70">
            © 2025 Flow Nova. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex w-full items-center justify-center bg-gray-50 px-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <img src={logo} alt="Flow Nova Logo" className="w-10 h-10" />
            <h2 className="text-3xl font-bold text-gray-900">Flow Nova</h2>
          </div>

          <div className="relative rounded-2xl bg-white p-8 border border-gray-200">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Create Account
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Sign in here.
                  </Link>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>

                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>

                <div>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                >
                  Create Account
                </button>
              </form>

              <div className="space-y-2">
                <p className="text-xs text-center text-gray-500">
                  By creating an account, you agree to our Terms of Service and
                  Privacy Policy.
                </p>
                <p className="text-xs text-center text-gray-500">
                  Takes less than a minute.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
