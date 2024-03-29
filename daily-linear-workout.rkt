#lang racket/base
(require "workout-types.rkt") 

#;(struct exercise (type ; is one of 'Primary 'Accessory
                    tool ; is-a Resistance
                    lift ; is-a String
                    goal-reps ; is-a Natural
                    resistance-level ; is-a Natural
                    volume)) ; is-a (Vector Natural (Vector Natural *))

(define (generate-new-workout exercise was-successful)
  (if (or (not was-successful)
          (>= (exercise-resistance-level exercise)
              (sub1 (vector-length (vector-ref (exercise-volume exercise) (exercise-goal-reps exercise))))))
      (generate-fail-day exercise)
      (generate-success-day exercise)))


(define (generate-success-day ex)
  (exercise
   (exercise-type ex)
   (exercise-tool ex)
   (exercise-lift ex)
   (exercise-goal-reps ex)
   (add1 (exercise-resistance-level ex))
   (exercise-volume ex)))

(define (generate-fail-day ex)
  (if (should-change-rep-scheme? ex)
      (exercise
       (exercise-type ex)
       (exercise-tool ex)
       (exercise-lift ex)
       (update-reps ex)
       (max 0 (- (exercise-resistance-level ex) 5))
       (exercise-volume ex))
      (exercise
       (exercise-type ex)
       (exercise-tool ex)
       (exercise-lift ex)
       (exercise-goal-reps ex)
       (max 0 (- (exercise-resistance-level ex) 5))
       (exercise-volume ex))))

(define (should-change-rep-scheme? ex)
  (let ([current-level (exercise-resistance-level ex)]
        [volume (exercise-volume ex)]
        [reps (exercise-goal-reps ex)])
    #t))

(define (update-reps ex)
  (define reps (exercise-goal-reps ex))
  (define is-primary (eq? (exercise-type ex) 'Primary))
  (cond
    [(and is-primary (> reps 1)) (sub1 reps)]
    [is-primary 10]
    [(> reps 11) 5]
    [#t (add1 reps)]))

(define (should-change-rep-scheme ex)
  (let* ([goal-reps (exercise-goal-reps ex)]
         [sets (vector (exercise-volume ex) goal-reps)]
         [max-level (sub1 (vector-length (vector-ref (exercise-volume exercise) (exercise-goal-reps exercise))))])
    (or (>= (exercise-resistance-level ex) max-level)
        (completed-max-volume? (exercise-resistance-level ex) sets))))


(define (completed-max-volume? resistance-level sets)
  (define max-sets 3)
  (define level (min resistance-level (vector-length sets)))
  (not (cond
         [(< level 5) (foldr (λ (l r) (or l r))
                             #f
                             (build-list level
                                         (λ (x)
                                           (< 
                                            (vector-ref sets x)
                                            max-sets))))]
         [#t (foldr (λ (l r) (or l r))
                    #f
                    (build-list 5
                                (λ (x)
                                  (< 
                                   (vector-ref sets (- level x 1))
                                   max-sets))))])))

(require rackunit)
#;(define (generate-test-cases)
  (for*/list ([level (in-range 6)]
              [set-length (in-range 1 6)])
    (define values (for/list ([_ set-length])
                     (random 5))) ; Generate values between 0 and 4
    (println values)
    (define input-sets (list->vector values))
    (define expected (completed-max-volume? level input-sets))
    (define test-name (format "Test for level: ~a, set length: ~a" level set-length))
    (define test (test-case test-name
                   (check-equal? (completed-max-volume? level input-sets) expected)))
    test))

(define (generate-test-cases)
  (for*/list ([level (in-range 6)]
              [set-length (in-range 1 6)])
    (define values (for/list ([_ set-length])
                     (random 5))) ; Generate values between 0 and 4
    (println values)
    (define input-sets (list->vector values))
    (define expected (completed-max-volume? level input-sets))
    (define test-name (format "Test for level: ~a, set length: ~a" level set-length))
    (test-case test-name
      (check-equal? (completed-max-volume? level input-sets) expected))))

(define test-cases (generate-test-cases))

;; Run the generated tests
#;(for ([test (in-list test-cases)])
  (run-test test))

(define some-test-suite
  (test-suite "completed-max-volume? tests"
    test-cases))

(run-test some-test-suite)