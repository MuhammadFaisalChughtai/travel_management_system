const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'web-client', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const importStatement = `import { ProtectedRoute } from './components/ProtectedRoute';\nimport { AuthRoute } from './components/AuthRoute';\n`;
content = content.replace("import { motion } from 'framer-motion';", "import { motion } from 'framer-motion';\n" + importStatement);

const oldRoutes = `<Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Hero />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Navigate to="/login" replace />} />
          <Route path="hotels" element={<HotelSearch />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bookings/:id" element={<BookingDetailsPage />} />
          <Route path="super-admin/login" element={<SuperAdminLogin />} />
          <Route path="super-admin/dashboard" element={<SuperAdminDashboard />} />
        </Route>
      </Routes>`;

const newRoutes = `<Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Hero />} />
          <Route path="hotels" element={<HotelSearch />} />
          
          <Route element={<AuthRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Navigate to="/login" replace />} />
            <Route path="super-admin/login" element={<SuperAdminLogin />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bookings/:id" element={<BookingDetailsPage />} />
          </Route>

          <Route element={<ProtectedRoute requireSuperAdmin={true} />}>
            <Route path="super-admin/dashboard" element={<SuperAdminDashboard />} />
          </Route>
        </Route>
      </Routes>`;

content = content.replace(oldRoutes, newRoutes);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated App routes successfully.");
