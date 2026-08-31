import { useEffect, useState } from 'react';
import axios from 'axios';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const getCurrentAcademicYearLabel = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 6 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
};

const cardStyles = 'rounded-lg border border-slate-200 bg-white p-6 shadow-sm';
const inputStyles = 'select w-full bg-white text-gray-900 border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm';
const textInputStyles = 'input w-full bg-white text-gray-900 border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm';

export default function HodCreateOffering() {
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [coordinatorId, setCoordinatorId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);

  const [formData, setFormData] = useState({
    subject_code: '',
    batch_id: '',
    sem_number: '1',
    accadmic_year: '',
    session: 'ODD',
    number_of_lectures: '',
    include_pso: true
  });

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      setAlert(null);
      try {
        const [subjectRes, meRes, batchRes] = await Promise.all([
          axios.get(`${SERVER_URL}/hod-assignment/subjects-list`, { withCredentials: true }),
          axios.get(`${SERVER_URL}/user/me`, { withCredentials: true }),
          axios.get(`${SERVER_URL}/hod-assignment/batches-list`, { withCredentials: true })
        ]);

        setSubjects(Array.isArray(subjectRes.data) ? subjectRes.data : []);
        setBatches(Array.isArray(batchRes.data) ? batchRes.data : []);
        setCoordinatorId(String(meRes.data?.user?.id || ''));
      } catch (err) {
        setAlert({ type: 'error', text: err?.response?.data?.message || 'Failed to load create offering form data.' });
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  useEffect(() => {
    const batch = batches.find((item) => String(item.batch_id) === String(formData.batch_id));
    if (!batch) {
      setFormData((prev) => ({ ...prev, accadmic_year: '' }));
      return;
    }

    const enrolledYear = Number.parseInt(batch.enrolled_year, 10);
    const semNumber = Number.parseInt(formData.sem_number, 10);
    if (!Number.isFinite(enrolledYear) || !Number.isFinite(semNumber)) {
      setFormData((prev) => ({ ...prev, accadmic_year: '' }));
      return;
    }

    const offset = semNumber <= 2 ? 0
      : semNumber <= 4 ? 1
      : semNumber <= 6 ? 2
      : 3;
    const startYear = enrolledYear + offset;
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
    const computedYear = `${startYear}-${endYearShort}`;

    setFormData((prev) => ({ ...prev, accadmic_year: computedYear }));
  }, [batches, formData.batch_id, formData.sem_number]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!coordinatorId) {
      setAlert({ type: 'error', text: 'Unable to resolve logged-in HOD id.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        subject_code: formData.subject_code,
        batch_id: Number(formData.batch_id),
        sem_number: Number(formData.sem_number),
        accadmic_year: formData.accadmic_year,
        session: String(formData.session || '').toUpperCase(),
        number_of_lectures: formData.number_of_lectures ? Number(formData.number_of_lectures) : null,
        faculty_corrdinator_id: Number(coordinatorId),
        include_pso: Boolean(formData.include_pso)
      };

      const res = await axios.post(`${SERVER_URL}/subject/offered/create`, payload, {
        withCredentials: true
      });

      setAlert({ type: 'success', text: res.data?.message || 'Offering created successfully.' });
      setFormData((prev) => ({
        ...prev,
        subject_code: '',
        number_of_lectures: ''
      }));
    } catch (err) {
      setAlert({ type: 'error', text: err?.response?.data?.message || 'Failed to create offering.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cardStyles}>
        <h2 className="text-3xl font-bold mb-1 text-slate-800">Create Subject Offering</h2>
        <p className="text-slate-500 mb-6 pb-4 border-b border-slate-100">
          Create an offering for your department. This will be used in subject assignment.
        </p>

        {alert && (
          <div className={`alert ${alert.type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'} mb-6 shadow-sm`}>
            <span>{alert.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-control w-full md:col-span-2">
            <label className="label py-1">
              <span className="label-text font-bold text-slate-700">Subject *</span>
            </label>
            <select
              name="subject_code"
              className={inputStyles}
              required
              value={formData.subject_code}
              onChange={handleChange}
              disabled={isLoading || isSubmitting}
            >
              <option value="" disabled>-- Choose a Subject --</option>
              {subjects.map((sub) => (
                <option key={sub.subject_code} value={sub.subject_code}>
                  {sub.name} ({sub.subject_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-control w-full">
            <label className="label py-1"><span className="label-text font-bold text-slate-700">Batch (Optional)</span></label>
            <select
              name="batch_id"
              className={inputStyles}
              value={formData.batch_id}
              onChange={handleChange}
              disabled={isLoading || isSubmitting}
            >
              <option value="">-- Choose a Batch (Optional) --</option>
              {batches.map((batch) => {
                const enrolled = batch.enrolled_year ? String(batch.enrolled_year) : "";
                const passing = batch.passing_year ? String(batch.passing_year) : "";
                const yearLabel = batch.batch_no || (enrolled && passing ? `${enrolled}-${passing}` : enrolled || passing || "");
                const courseLabel = batch.course_name ? String(batch.course_name) : "Course";
                const branchLabel = batch.branch_code ? ` • ${batch.branch_name || "Branch"} (${batch.branch_code})` : "";
                return (
                  <option key={batch.batch_id} value={String(batch.batch_id)}>
                    {courseLabel}{branchLabel} • {yearLabel || "Batch"}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-control w-full">
            <label className="label py-1"><span className="label-text font-bold text-slate-700">Semester *</span></label>
            <select name="sem_number" className={inputStyles} value={formData.sem_number} onChange={handleChange}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>Sem {s}</option>
              ))}
            </select>
          </div>

          <div className="form-control w-full">
            <label className="label py-1"><span className="label-text font-bold text-slate-700">Session *</span></label>
            <select name="session" className={inputStyles} value={formData.session} onChange={handleChange}>
              <option value="ODD">ODD</option>
              <option value="EVEN">EVEN</option>
            </select>
          </div>

          <div className="form-control w-full">
            <label className="label py-1"><span className="label-text font-bold text-slate-700">Academic Year *</span></label>
            <input
              name="accadmic_year"
              className={textInputStyles}
              placeholder="e.g. 2025-26"
              value={formData.accadmic_year}
              onChange={handleChange}
              readOnly
              required
            />
          </div>

          <div className="form-control w-full">
            <label className="label py-1"><span className="label-text font-bold text-slate-700">Number of Lectures</span></label>
            <input
              name="number_of_lectures"
              type="number"
              min="0"
              className={textInputStyles}
              placeholder="e.g. 45"
              value={formData.number_of_lectures}
              onChange={handleChange}
            />
          </div>

          <div className="form-control w-full">
            <label className="label py-1"><span className="label-text font-bold text-slate-700">Include PSO?</span></label>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="include_pso"
                className="toggle toggle-primary"
                checked={Boolean(formData.include_pso)}
                onChange={handleChange}
              />
              <span className="text-sm text-slate-600">
                {formData.include_pso ? 'PSO included for this offering' : 'PSO not included for this offering'}
              </span>
            </div>
          </div>

          <div className="form-control w-full md:col-span-2 mt-2">
            <button
              type="submit"
              className="btn btn-primary w-full md:w-72 shadow-sm"
              disabled={isLoading || isSubmitting}
            >
              {isSubmitting ? <span className="loading loading-spinner"></span> : 'Create Offering'}
            </button>
          </div>
        </form>
    </div>
  );
}
