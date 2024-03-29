#lang racket/base
(require "current-workout.rkt")
(provide store-workout
         read-workout)

(define (store-workout file-name workout)
  (with-output-to-file file-name (λ ()
                                   (define output-port (open-output-string))
                                   (write workout output-port)
                                   (printf (get-output-string output-port)))
    #:exists 'replace))

(define (read-workout file-name)
  (define in (open-input-file file-name))
  (define workout (read in))
  (close-input-port in)
  workout)


(store-workout "test.txt" current-workout)

(define workout (read-workout "test.txt"))

(equal? current-workout workout)
