import {db} from './firebase'
import {
    addDoc,
    getDoc,
    updateDoc,
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    where,
    deleteDoc,
} from "firebase/firestore";

/* COLLECTIONS: An object that holds the names of the collections in the Firestore database */
const COLLECTIONS = {
    COURSES: 'Courses',
    STUDENTS: 'Students',
    SESSIONS: 'Sessions',
    USERS: 'Users',
    ATTENDANCE: 'Attendance'
}

/*
    The following functions are used to interact with the Firestore database.
    They are used to add, edit, and delete courses, students, and sessions.
    They also get courses, students, and sessions from the database.
*/


/* addCourse: Adds a course to the database
    * @param courseName -  The name of the course
    * @param courseSection - The section of the course
    * @param uid -  The user id of the user who created the course
 */
export function addCourse(courseName, courseSection, uid) {
    addDoc(collection(db, COLLECTIONS.COURSES), {
        courseName, courseSection, uid,
    })
}

/* addStudent: Adds a student to a course
    * @param courseId -  The id of the course
    * @param studentData - The data of the student
    * @returns - The id of the student
 */
export function editCourse(courseName, courseSection, id) {
    const courseRef = doc(db, COLLECTIONS.COURSES, id);
    updateDoc(courseRef, {
        courseName, courseSection,
    })
}

/* addStudent: Adds a student to a course
    * @param courseId -  The id of the course
    * @param studentData - The data of the student
    * @returns - The id of the student
 */
export async function addStudent(courseId, studentData) {
    try {
        const studentsRef = collection(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.STUDENTS)
        const docRef = await addDoc(studentsRef, studentData)
        return docRef.id
    } catch (error) {
        console.error('Error adding student:', error)
        throw error
    }
}


export async function recordAttendance(courseId, studentId, sessionId) {
    try {
        // Creating reference to course
        const courseRef = doc(db, COLLECTIONS.COURSES, courseId)
        // Creating reference to Student document in the course
        const studentRef = doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.STUDENTS, studentId)
        // Creating reference to session
        const sessionRef = doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS, sessionId)

        // Checking if student,course and session record exists
        const student = await getDoc(studentRef);
        const course = await getDoc(courseRef);
        const session = await getDoc(sessionRef);

        // get the session data
        const sessionData = session.data();

        // variables to store the session start time and grace period
        let sessionStartTime = null;
        let gracePeriod = null;

        // get the session start time
        const sessionStartTimeString = sessionData.sessionStart;

        if(sessionStartTimeString !== null) {
            const sessionStartTimeDate = new Date(sessionStartTimeString);
            sessionStartTime = sessionStartTimeDate.toISOString();
            console.log("Session start time:", sessionStartTime)
        }else{
            sessionStartTime = null;
        }

        // get the session grace period
        const gracePeriodString = sessionData.gracePeriod;
        console.log("Grace period string:", gracePeriodString)
        if(gracePeriodString !== null) {
            const gracePeriodDate = new Date(gracePeriodString);
            gracePeriod = gracePeriodDate.toISOString();
            console.log("Grace period:", gracePeriod)
        }else{
            gracePeriod = null;
        }

        // get the current time
        const currentTime = new Date().toISOString();
        console.log("Current time:", currentTime)

        // if the course has a start time and has not started yet
        if(sessionStartTime && currentTime < sessionStartTime){
            window.alert("The session has not started yet, you can not record attendance for this session")
            return
        }
        // if the course has a grace period and the current time is outside the grace period
        if(gracePeriod && currentTime > gracePeriod){
            window.alert("The grace period has ended, you can no longer record attendance for this session")
            return
        }

        // Checking if attendance record already exists get first
        const q = query(collection(db, COLLECTIONS.ATTENDANCE), where('studentRef', '==', studentRef), where('sessionRef', '==', sessionRef));
        // Execute the query
        const querySnapshot = await getDocs(q);

        // If attendance record already exists (student in class) , update the status of the student to be present
        if (!querySnapshot.empty) {
            querySnapshot.forEach( async (document) => {
                const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, document.id);
                await updateDoc(attendanceRef, {
                    status: "Present"
                })
            })
        }

    } catch (error) {
        console.error('Error recording attendance')
    }
}

/* editStudent: Edits a student in a course
    * @param courseId -  The id of the course
    * @param studentId - The id of the student
    * @param newData - The new data for the student
 */
export async function editStudent(courseId, studentId, newData) {
    try {
        const studentRef = doc(
            db,
            COLLECTIONS.COURSES,
            courseId,
            COLLECTIONS.STUDENTS,
            studentId
        );

        console.log("Student reference:", studentRef);
        await updateDoc(studentRef, newData);
        const path = `${COLLECTIONS.COURSES}/${courseId}/${COLLECTIONS.STUDENTS}/${studentId}`;
        console.log("Student data updated successfully!", path);
    } catch (error) {
        console.error("Error editing student data in:", error);
        throw error;
    }
}


/* addSession: Adds a session to a course
    * @param courseId -  The id of the course
    * @param sessionData - The data of the session
    * @returns - The id of the session
 */

export async function addSession(courseId, sessionData) {
    try {
        const sessionsRef = collection(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS)
        const docRef = await addDoc(sessionsRef, sessionData)

        // After the session is created we need to create an attendance record for each student in the course
        const students = await getStudents(courseId);
        for (const student of students) {
            await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
                courseRef: doc(db, COLLECTIONS.COURSES, courseId),
                studentRef: doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.STUDENTS, student.id),
                sessionRef: doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS, docRef.id),
                status: "Not Scanned",
            })
        }

        return docRef.id

    } catch (error) {
        console.error('Error adding session:', error)
        throw error
    }
}

// Function to edit a session's data
export async function editSession(courseId, sessionId, newData) {
    try {
        const sessionRef = doc(
            db,
            COLLECTIONS.COURSES,
            courseId,
            COLLECTIONS.SESSIONS,
            sessionId
        );

        console.log("Session reference:", sessionRef);
        await updateDoc(sessionRef, newData);
        const path = `${COLLECTIONS.COURSES}/${courseId}/${COLLECTIONS.SESSIONS}/${sessionId}`;
        console.log("Session data updated successfully!", path);
    } catch (error) {
        console.error("Error editing session data:", error);
        throw error;
    }
}

/* getCourses: Gets all courses for a user
    * @param uid -  The user id of the logged-in user
    * @returns - An array of courses
 */
export async function getCourses(uid) {
    return new Promise((resolve, reject) => {
        const courses = []
        const q = query(collection(db, COLLECTIONS.COURSES), where('uid', '==', uid))

        onSnapshot(q, (querySnapshot) => {
            querySnapshot.forEach((doc) => {
                courses.push({...doc.data(), id: doc.id})
            })
            resolve(courses)
        }, (error) => {
            reject(error)
        })
    })
}

export async function getAttendanceData(sessionId, courseId) {
    return new Promise(async (resolve, reject) => {
        // Creating reference to session
        const sessionRef = doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS, sessionId);
        // Creating reference to course
        const courseRef = doc(db, COLLECTIONS.COURSES, courseId);
        const data = [];
        const q = query(collection(db, COLLECTIONS.ATTENDANCE), where('sessionRef', '==', sessionRef), where('courseRef', '==', courseRef));

        onSnapshot(q, async (querySnapshot) => {
            const docsPromises = querySnapshot.docs.map(async (doc) => {
                const attendanceData = doc.data();
                const studentRef = attendanceData.studentRef;
                const studentDoc = await getDoc(studentRef);
                if (studentDoc.exists()) {
                    const studentData = studentDoc.data();
                    // Spread the student's data along with the attendance record at the same level
                    return {
                        ...attendanceData, // Attendance data
                        id: doc.id, // Attendance ID
                        firstName: studentData.firstName, // Student's firstName
                        lastName: studentData.lastName, // The ID of the student document
                        // Include additional student fields as needed
                    };
                }
            });

            // Wait for all student details to be fetched
            const compiledData = await Promise.all(docsPromises);
            resolve(compiledData);
        }, (error) => {
            reject(error);
        });
    });
}

/* getStudents: Gets all students for a course
    * @param courseId -  The id of the course
 */
export async function getStudents(courseId) {

    try {
        const studentsRef = collection(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.STUDENTS);
        const q = query(studentsRef);
        const querySnapshot = await getDocs(q);

        const students = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            courseId: courseId
        }));

        return students;
    } catch (error) {
        console.error('Error fetching students:', error);
        throw error; // Re-throw to allow app to handle if needed
    }

}

/* getSessions: Gets all sessions for a course
    * @param courseId -  The id of the course
    * @returns - An array of sessions
 */
export async function getSessions(courseId) {
    try {
        const sessions = []
        const sessionsRef = collection(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS)
        const q = query(sessionsRef)

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            sessions.push({...doc.data(), id: doc.id, courseId: courseId}); // Include courseId
        });

        return sessions;
    } catch (error) {
        console.error("Error fetching sessions:", error);
        throw error;
    }
}

/* deleteStudent: Deletes a student from a course
    * @param courseId -  The id of the course
    * @param studentId - The id of the student

 */
export async function deleteStudent(courseId, studentId) {
    try {
        // Construct the path to the specific student document
        const studentRef = doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.STUDENTS, studentId);

        await deleteDoc(studentRef);
    } catch (error) {
        console.error("Error deleting student:", error);
        throw error;
    }
}

/* deleteCourse: Deletes a course
    * @param courseId -  The id of the course
 */
export async function deleteCourse(courseId) {
    try {
        const courseRef = doc(db, COLLECTIONS.COURSES, courseId);
        await deleteDoc(courseRef);
    } catch (error) {
        console.error("Error deleting course:", error);
        throw error;
    }
}

/* deleteSession: Deletes a session from a course
    * @param courseId -  The id of the course
    * @param sessionId - The id of the session
 */
export async function deleteSession(courseId, sessionId) {
    try {
        const sessionRef = doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS, sessionId);
        await deleteDoc(sessionRef);
    } catch (error) {
        console.error("Error deleting session:", error);
        throw error;
    }
}

/* updateSession: Updates a session in a course
    * @param courseId -  The id of the course
    * @param sessionId - The id of the session
    * @param newData - The new data for the session
 */
export async function updateSession(courseId, sessionId, newData) {
    try {
        const sessionRef = doc(db, COLLECTIONS.COURSES, courseId, COLLECTIONS.SESSIONS, sessionId);

        await updateDoc(sessionRef, newData);

        console.log("Session information updated successfully!");
    } catch (error) {
        console.error("Error updating session information:", error);
        throw error;
    }
}