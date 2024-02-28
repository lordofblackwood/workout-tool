#lang typed/racket/base

(require "workout-types.rkt"
         "weight-progression.rkt")

(define squats
  (Exercise 'Primary 'Barbell "Squat"
            5 245 0
            (build-list 5 (λ (x) 1))
            (build-list 5 (λ ([x : Natural]) (+ x (get-level 'Barbell 245))))))

#; (struct Exercise ([type : (U 'Primary 'Accessory)]
                  [tool : ResistanceMode]
                  [lift : String]
                  [goal-reps : Natural]
                  [goal-weight : Natural]
                  [consecutive-regressions : Natural]
                  [sets : (Listof Positive-Integer)]
                  [resistance : (Listof Natural)]))


(: generate-day (-> Exercise Boolean Exercise))
(define (generate-day exercise completed)
  (let ([new-regressions (if completed (Exercise-consecutive-regressions exercise) (add1 (Exercise-consecutive-regressions exercise)))]
        [])
  (if completed
      (Exercise
       (Exercise-type exercise)
       (Exercise-tool exercise)
       (Exercise-lift exercise)
       (Exercise-goal-reps exercise)
       (Exercise-goal-weight exercise)
       new-regressions
       (Exercise-sets exercise)
       (Exercise-resistance exercise))
      (Exercise
       (Exercise-type exercise)
       (Exercise-tool exercise)
       (Exercise-lift exercise)
       (Exercise-goal-reps exercise)
       (Exercise-goal-weight exercise)
       new-regressions
       (Exercise-sets exercise)
       (Exercise-resistance exercise)))))

(define (sucessful-lift exercise)
  (let ([new-goal-weight (max (Exercise-goal-weight exercise)
                              (get-weight (add1 (car (Exercise-resistance exercise)))))]
        [new-sets (cons 1 (Exercise-sets exercise))]
  (Exercise
       (Exercise-type exercise)
       (Exercise-tool exercise)
       (Exercise-lift exercise)
       (Exercise-goal-reps exercise)
       new-goal-weight
       (Exercise-consecutive-regressions exercise) 
       new-sets
       (Exercise-resistance exercise)))

