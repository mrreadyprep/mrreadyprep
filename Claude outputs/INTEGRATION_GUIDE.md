# Reviews Frontend - Integration Guide

## 📁 Files

Three files created. Copy to the following locations:

```
frontend/src/components/ReviewsSection.jsx     ← ReviewsSection.jsx
frontend/src/components/PostTestReview.jsx     ← PostTestReview.jsx
```

---

## 1️⃣ Home.jsx - Add ReviewsSection

Open `frontend/src/pages/Home.jsx` and:

### Step 1: Add import (at the top with other imports)
```javascript
import ReviewsSection from '../components/ReviewsSection';
```

### Step 2: Replace Testimonials section with ReviewsSection

**Find the old code:**
```javascript
<TestimonialsSection />
```

**Replace with:**
```javascript
<ReviewsSection />
```

### Step 3: Remove TestimonialsSection import (if exists)
Delete this line:
```javascript
import TestimonialsSection from '../components/TestimonialsSection';
```

---

## 2️⃣ Add PostTestReview to Test Components

You need to add the PostTestReview modal to each test component (Reading Part 1, 2, 3 / Listening / Writing / Speaking).

### Example: Reading Part 1 Component (ReadingPart1.jsx)

**Step 1: Add import**
```javascript
import PostTestReview from '../components/PostTestReview';
```

**Step 2: Add state (inside component)**
```javascript
const [showReviewModal, setShowReviewModal] = useState(false);
```

**Step 3: Render Modal on Test Results Screen**

Open the modal when user finishes the test (on results screen).

**For example, add this JSX on the results screen:**
```javascript
{showResults && (
  <>
    {/* Mevcut sonuç ekranı... */}
    <ResultsScreen score={score} />

    {/* PostTestReview Modal'ı ekle */}
    <PostTestReview
      isOpen={showReviewModal}
      onClose={() => setShowReviewModal(false)}
      courseType="reading"  {/* Ya da "listening", "writing", "speaking" */}
    />
  </>
)}
```

**Step 4: Trigger to Open Modal**

When results screen is shown, open the modal automatically or on user click:

```javascript
useEffect(() => {
  if (showResults) {
    setShowReviewModal(true);  // Otomatik aç
  }
}, [showResults]);
```

Or with a button:
```javascript
<button onClick={() => setShowReviewModal(true)}>
  Share Your Experience
</button>
```

---

## 3️⃣ Apply to All Test Components

Repeat the same steps for each component below:

1. **ReadingPart1.jsx** → `courseType="reading"`
2. **ReadingPart2.jsx** → `courseType="reading"`
3. **ReadingPart3.jsx** → `courseType="reading"`
4. **ListeningComponent.jsx** → `courseType="listening"`
5. **WritingComponent.jsx** → `courseType="writing"`
6. **SpeakingComponent.jsx** → `courseType="speaking"`
7. **FullMockTest.jsx** → `courseType="all_sections"`

---

## 4️⃣ Authentication Check (Important!)

Backend's `/api/reviews/submit` **requires authorization** (`get_current_user`).

If the test-taking user is not logged in, show a warning when opening modal:

```javascript
const handleOpenReview = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must log in to submit a review');
    // Redirect to login page
    return;
  }
  setShowReviewModal(true);
};
```

---

## 5️⃣ Props and Features

### ReviewsSection
- **No props** - fully automatic
- Fetches from backend `/api/reviews/stats` and `/api/reviews/list`
- Static section on landing page

### PostTestReview
```javascript
<PostTestReview
  isOpen={boolean}              // Is modal open?
  onClose={function}            // Called when modal closes
  courseType={string}           // "all_sections" | "reading" | "listening" | "writing" | "speaking"
/>
```

---

## 6️⃣ Styling Notes

- ✅ **Inline styles used** (No Tailwind)
- ✅ **Fixed, non-scrollable layouts** implemented
- ✅ **Brand color (#701fa1)** in gradients and hovers
- ✅ Responsive (mobile friendly)

---

## 7️⃣ Testing Checklist

After integration, test everything:

- [ ] ReviewsSection loading on landing page?
- [ ] Stats cards showing backend data?
- [ ] Review cards looking good?
- [ ] Modal opening when any test finishes?
- [ ] Form validation working in modal?
- [ ] Data going to backend when "Submit" clicked?
- [ ] Success message showing?
- [ ] Modal auto-closing after 3 seconds?
- [ ] Non-authenticated users getting warned?

---

## 8️⃣ Troubleshooting

### Modal not opening
- Check browser console for errors
- Test manually with `isOpen={true}`

### Stats/Reviews not loading
- Is backend endpoint working? → Test `/api/reviews/stats`
- Check for CORS errors
- Backend database might be empty (first time)

### Form not submitting
- Is user logged in? → Check token
- Is request going in Network tab?
- Any error from backend?

---

## 9️⃣ Next Steps

1. ✅ Integrate ReviewsSection + PostTestReview
2. ✅ Add modal to all test components
3. ✅ Git commit
4. ✅ Push and deploy on Render
5. Testing: Test landing page + post-test modal
6. Future task: Email notifications, moderation dashboard

---

**Any questions? Ready to start?**
